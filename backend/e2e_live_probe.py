import json
import time
import urllib.request
import urllib.error
import uuid

BASE = 'http://127.0.0.1:8000'


def request(method, path, data=None, token=None):
    body = None
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    if data is not None:
        body = json.dumps(data).encode('utf-8')
    req = urllib.request.Request(BASE + path, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            txt = resp.read().decode('utf-8')
            parsed = json.loads(txt) if txt else {}
            return resp.status, parsed
    except urllib.error.HTTPError as e:
        txt = e.read().decode('utf-8')
        parsed = json.loads(txt) if txt else {}
        return e.code, parsed


def get_data(payload):
    if isinstance(payload, dict):
        if 'data' in payload:
            return payload['data']
        return payload
    return payload

summary = {}

# 1) health
status, payload = request('GET', '/health')
summary['health'] = {'status': status, 'ok': status == 200}

# 2) register + login
stamp = str(int(time.time()))
email = f'e2e_{stamp}@example.com'
password = 'E2ePass!12345'
register_body = {
    'email': email,
    'password': password,
    'confirm_password': password,
    'name': 'E2E Runner',
    'company_name': 'Spann E2E',
    'locale': 'en-US'
}
status, payload = request('POST', '/auth/register', register_body)
summary['register'] = {'status': status, 'ok': status in (200, 201)}
reg_data = get_data(payload) if status in (200, 201) else {}
access = reg_data.get('access_token')
refresh = reg_data.get('refresh_token')
workspace_id = reg_data.get('workspace_id')

if not access:
    status, payload = request('POST', '/auth/login', {'email': email, 'password': password})
    summary['login'] = {'status': status, 'ok': status == 200}
    login_data = get_data(payload) if status == 200 else {}
    access = login_data.get('access_token')
    refresh = login_data.get('refresh_token')
else:
    summary['login'] = {'status': 'skipped', 'ok': True}

# 3) users/me and onboarding
if access:
    status, payload = request('GET', '/users/me', token=access)
    summary['users_me'] = {'status': status, 'ok': status == 200}

    status, payload = request('GET', '/organizations/onboarding', token=access)
    onboarding_ok = status == 200
    summary['onboarding'] = {'status': status, 'ok': onboarding_ok}
    if onboarding_ok:
        data = get_data(payload)
        if not workspace_id:
            workspace_id = data.get('current_workspace_id')
            if not workspace_id and data.get('my_organizations'):
                workspace_id = data['my_organizations'][0].get('workspace_id')

# 4) channels/messages/reactions/edit/delete
channel_id = None
message_id = None
if access and workspace_id:
    status, payload = request('POST', '/channels', {
        'workspace_id': workspace_id,
        'name': f'e2e-{stamp}',
        'description': 'e2e live probe',
        'tone': 'neutral',
        'is_private': False
    }, token=access)
    summary['create_channel'] = {'status': status, 'ok': status in (200, 201)}
    if status in (200, 201):
        channel_id = get_data(payload).get('id')

if access and channel_id:
    status, payload = request('POST', '/messages', {
        'channel_id': channel_id,
        'text': 'hello from live e2e probe',
        'source_locale': 'en-US'
    }, token=access)
    summary['send_message'] = {'status': status, 'ok': status in (200, 201)}
    if status in (200, 201):
        message_id = get_data(payload).get('id')

if access and channel_id:
    status, payload = request('GET', f'/channels/{channel_id}/messages', token=access)
    summary['list_messages'] = {'status': status, 'ok': status == 200}

if access and message_id:
    status, payload = request('POST', f'/messages/{message_id}/reactions', {'emoji': '??'}, token=access)
    summary['reaction_toggle'] = {'status': status, 'ok': status in (200, 201)}

if access and message_id:
    status, payload = request('PATCH', f'/messages/{message_id}', {'text': 'hello from live e2e probe edited'}, token=access)
    summary['edit_message'] = {'status': status, 'ok': status in (200, 201)}

if access and message_id:
    status, payload = request('DELETE', f'/messages/{message_id}', token=access)
    summary['delete_message'] = {'status': status, 'ok': status in (200, 204)}

# 5) translation
if access:
    status, payload = request('POST', '/translate', {
        'phrase': 'hola equipo',
        'source_locale': 'es-ES',
        'target_locale': 'en-US',
        'source_culture': 'spanish',
        'target_culture': 'american',
        'workplace_tone': 'neutral'
    }, token=access)
    summary['translate'] = {'status': status, 'ok': status == 200}

# 6) carbon
if access and workspace_id:
    status, payload = request('POST', '/carbon/log', {
        'workspace_id': workspace_id,
        'transport_type': 'bus',
        'kg_co2': 0.8
    }, token=access)
    summary['carbon_log'] = {'status': status, 'ok': status in (200, 201)}

    status, payload = request('GET', f'/carbon/leaderboard?workspace_id={workspace_id}', token=access)
    summary['carbon_leaderboard'] = {'status': status, 'ok': status == 200}

# 7) mesh basic (register/list)
if access:
    status, payload = request('POST', '/mesh/register', {'node_name': 'e2e-node'}, token=access)
    summary['mesh_register'] = {'status': status, 'ok': status in (200, 201)}

    status, payload = request('GET', '/mesh/nodes', token=access)
    summary['mesh_nodes'] = {'status': status, 'ok': status == 200}

# 8) token refresh/logout
if refresh:
    status, payload = request('POST', '/auth/refresh', {'refresh_token': refresh})
    summary['refresh'] = {'status': status, 'ok': status == 200}
    refreshed_data = get_data(payload) if status == 200 else {}
    refresh_for_logout = refreshed_data.get('refresh_token') or refresh

    status, payload = request('POST', '/auth/logout', {'refresh_token': refresh_for_logout}, token=access)
    summary['logout'] = {'status': status, 'ok': status == 200}

ok_count = sum(1 for item in summary.values() if item.get('ok'))
summary['totals'] = {'passed': ok_count, 'total': len(summary)}
print(json.dumps(summary, indent=2))
