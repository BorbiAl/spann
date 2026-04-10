const fs = require('fs');
let code = fs.readFileSync('src/views/ChatView.jsx', 'utf8');

// Replace state
code = code.replace(/const \[inputValue, setInputValue\] = useState\(""\);/g, 'const [inputValue, setInputValue] = useState("");\n        const [isSending, setIsSending] = useState(false);');

// Replace function body
code = code.replace(/function sendMessage\(\)\s*\{[\s\S]*?setInputValue\(""\);\s*\}/, 'async function sendMessage() {\n                const text = inputValue.trim();\n                if (!text || isSending) {\n                        return;\n                }\n\n                setIsSending(true);\n                try {\n                        await onSendMessage(activeChannel, text, translateEnabled);\n                } finally {\n                        setIsSending(false);\n                        setInputValue("");\n                }\n        }');

// Replace button accurately matching active:scale-95
code = code.replace(/<button\s+className="bg-\[#0f67b7\] text-white[^>]*?active:scale-95"\s+onClick={sendMessage}[\s\S]*?<\/button>/, '<button\n                                                                className={`bg-[#0f67b7] text-white pl-4 pr-3 py-[6px] rounded-[16px] text-[14px] font-semibold flex items-center justify-center gap-1.5 hover:bg-[#0b4b8a] transition-all cursor-pointer shadow-sm ${isSending ? "opacity-75 cursor-wait" : "active:scale-95"}`}\n                                                                onClick={sendMessage}\n                                                                disabled={isSending}\n                                                                aria-label={isSending ? "Sending message..." : "Send message"}\n                                                                type="button"\n                                                        >\n                                                                <span>{isSending ? "Sending..." : "Send"}</span>\n                                                                {isSending ? <span className="material-symbols-outlined text-[16px] animate-spin" data-icon="sync">sync</span> : <span className="material-symbols-outlined text-[16px]" data-icon="send">send</span>}\n                                                        </button>');

fs.writeFileSync('src/views/ChatView.jsx', code);
