const fs = require('fs');
let c = fs.readFileSync('src/views/ChatView.jsx', 'utf8');
c = c.replace(/<button[^>]*?onClick={sendMessage}[^>]*?>[\s\S]*?<\/button>/m, <button type="button" className={\g-[#0f67b7] text-white pl-4 pr-3 py-[6px] rounded-[16px] text-[14px] font-semibold flex items-center justify-center gap-1.5 hover:bg-[#0b4b8a] transition-all cursor-pointer shadow-sm \\} disabled={isSending} onClick={sendMessage}><span>{isSending ? "Sending..." : "Send"}</span>{isSending ? <span className="material-symbols-outlined text-[16px] animate-spin" data-icon="sync">sync</span> : <span className="material-symbols-outlined text-[16px]" data-icon="send">send</span>}</button>);
fs.writeFileSync('src/views/ChatView.jsx', c);
