/**
 * HTML template for the Spann personal tab.
 *
 * The page:
 *  1. Initialises the Teams JS SDK and retrieves the user context.
 *  2. Calls GET /tab/api/settings to load the current profile.
 *  3. Renders the Adaptive Card using the adaptivecards JS library (CDN).
 *  4. On submit, posts to POST /tab/api/settings and shows a success state.
 *
 * Security note: In production, the /tab/api/* routes should validate a
 * Teams SSO token (see README § 6 for how to add Teams SSO).  For local dev,
 * userId + tenantId are passed from the Teams context as query parameters.
 */

export function buildSettingsPage(origin: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-inline' 'unsafe-eval' https://res.cdn.office.net https://unpkg.com https://statics.teams.cdn.office.net; img-src * data:;">
  <title>Spann Accessibility Settings</title>
  <script src="https://res.cdn.office.net/teams-js/2.22.0/js/MicrosoftTeams.min.js" crossorigin="anonymous"></script>
  <script src="https://unpkg.com/adaptivecards@3.0.1/dist/adaptivecards.min.js" crossorigin="anonymous"></script>
  <style>
    *  { box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      margin: 0;
      padding: 24px 16px;
      background: #f5f5f5;
      color: #242424;
    }
    #loading {
      text-align: center;
      padding: 60px 20px;
      color: #616161;
    }
    #loading p { font-size: 16px; margin: 0; }
    #error {
      display: none;
      background: #fde7e9;
      border: 1px solid #f4b8bf;
      border-radius: 6px;
      padding: 16px;
      color: #611;
      max-width: 640px;
      margin: 24px auto;
    }
    #success {
      display: none;
      background: #dff6dd;
      border: 1px solid #9dd5a0;
      border-radius: 6px;
      padding: 24px;
      text-align: center;
      max-width: 640px;
      margin: 24px auto;
      color: #107c10;
      font-size: 18px;
      font-weight: 600;
    }
    #card-container {
      display: none;
      max-width: 640px;
      margin: 0 auto;
      background: white;
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 2px 8px rgba(0,0,0,.08);
    }
    /* Adaptive Card overrides */
    .ac-pushButton {
      background-color: #6264a7 !important;
      color: white !important;
      border: none !important;
      padding: 8px 20px !important;
      border-radius: 4px !important;
      cursor: pointer !important;
      font-size: 14px !important;
      font-weight: 600 !important;
    }
    .ac-pushButton:hover { background-color: #4f52a0 !important; }
    .ac-textBlock { font-family: 'Segoe UI', sans-serif !important; }
  </style>
</head>
<body>
  <div id="loading"><p>⏳ Loading your accessibility settings…</p></div>
  <div id="error"></div>
  <div id="success">✓ Accessibility settings saved!</div>
  <div id="card-container"></div>

  <script>
    const ORIGIN = ${JSON.stringify(origin)};

    microsoftTeams.app.initialize().then(function () {
      return microsoftTeams.app.getContext();
    }).then(function (ctx) {
      var userId   = (ctx.user && ctx.user.id) ? ctx.user.id : '';
      var tenantId = (ctx.user && ctx.user.tenant && ctx.user.tenant.id) ? ctx.user.tenant.id : '';

      if (!userId || !tenantId) {
        showError('Could not determine your Teams identity. Please reopen this tab.');
        return;
      }

      return fetch(
        ORIGIN + '/tab/api/settings'
          + '?userId='   + encodeURIComponent(userId)
          + '&tenantId=' + encodeURIComponent(tenantId)
      )
      .then(function (r) { return r.json(); })
      .then(function (data) {
        renderCard(data.cardJson, userId, tenantId);
      });
    }).catch(function (err) {
      showError('Failed to load settings: ' + (err && err.message ? err.message : String(err)));
    });

    function renderCard(cardJson, userId, tenantId) {
      var ac = new AdaptiveCards.AdaptiveCard();
      AdaptiveCards.AdaptiveCard.onParseError = function (err) {
        console.warn('AC parse warning:', err);
      };

      ac.onExecuteAction = function (action) {
        if (!(action instanceof AdaptiveCards.SubmitAction)) return;

        var data = Object.assign({}, action.data, {
          userId:   userId,
          tenantId: tenantId,
        });

        fetch(ORIGIN + '/tab/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
        .then(function (r) { return r.json(); })
        .then(function (res) {
          if (res.ok) {
            document.getElementById('card-container').style.display = 'none';
            document.getElementById('success').style.display = 'block';
            microsoftTeams.pages.config.notifySuccess();
          } else {
            showError('Save failed: ' + (res.error || 'Unknown error'));
          }
        })
        .catch(function (err) {
          showError('Save failed: ' + (err && err.message ? err.message : String(err)));
        });
      };

      try {
        ac.parse(cardJson);
      } catch (e) {
        showError('Could not render settings card: ' + e.message);
        return;
      }

      var rendered = ac.render();
      if (!rendered) {
        showError('Adaptive Card rendered nothing. Check console for details.');
        return;
      }

      var container = document.getElementById('card-container');
      document.getElementById('loading').style.display = 'none';
      container.style.display = 'block';
      container.appendChild(rendered);
    }

    function showError(msg) {
      document.getElementById('loading').style.display = 'none';
      var el = document.getElementById('error');
      el.textContent = '⚠️ ' + msg;
      el.style.display = 'block';
    }
  </script>
</body>
</html>`;
}
