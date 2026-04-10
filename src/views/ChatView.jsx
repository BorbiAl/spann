import React, { useEffect, useState } from "react";
import Icon from "../components/Icon";
import Message from "../components/Message";
import { CHANNELS } from "../data/constants";

const PRESENCE_MEMBERS = [
	{
		id: "sarah",
		name: "Sarah Chen",
		avatar:
			"https://lh3.googleusercontent.com/aida-public/AB6AXuCeX83POcK2ErUQRuh8dLEiZzV2zBzREt2WJ06F2PjbO7eT9obL2mn3MNVweL9NJEUSctvCB5_9w0xkWD_IjeNDBZsWh3LjbBhrt5CYyK1dYy2hEAPPPu5YO0w7obgjjPhyx8BZ7NyWuK6w1nDnSwpycWhj2ty3n9ITfSGoUHDuTTMjz1OsJKRDF5ZSeA7KY-2LUIVsTIt4NQqD5L9Wpnf4Q1SwIbL-SOHN96csvROrp6AlL7dLgcs3fPi2Z2cOT9pZuZv1OgfJZx1U"
	},
	{
		id: "marcus",
		name: "Marcus Kane",
		initials: "MK"
	}
];

export default function ChatView({
	activeChannel,
	channelMood,
	messages,
	onSendMessage,
	onReactMessage,
	translateEnabled,
	setTranslateEnabled,
	showNudge,
	setShowNudge
}) {
	const [inputValue, setInputValue] = useState("");
        const [isSending, setIsSending] = useState(false);


	const sentimentScore = Number(channelMood || CHANNELS.find((channel) => channel.name === activeChannel)?.mood || 65);
	const sentimentLabel = sentimentScore > 70 ? "Collaborative" : sentimentScore > 45 ? "Neutral" : "Critical";
	const trimmedMessages = Array.isArray(messages) ? messages.slice(-12) : [];

	useEffect(() => {
		setInputValue("");
	}, [activeChannel]);

	async function sendMessage() {
                const text = inputValue.trim();
                if (!text || isSending) {
                        return;
                }

                setIsSending(true);
                try {
                        await onSendMessage(activeChannel, text, translateEnabled);
                } finally {
                        setIsSending(false);
                        setInputValue("");
                }
        }

	return (
		<div className="flex-1 flex flex-col min-w-0 bg-white">
			{/* Top App Bar */}
			<header className="h-[60px] flex items-center justify-between px-6 bg-white sticky top-0 z-10 border-b border-black/5">
				<div className="flex items-center gap-3">
					<span className="text-[#0b4b8a] text-[20px] font-medium">#</span>
					<h2 className="font-bold text-[#1D1D1F] text-[18px] tracking-tight">{String(activeChannel || "product-strategy").replace(/^#/, "")}</h2>
					<span className="material-symbols-outlined text-[#1D1D1F] opacity-40 text-[18px] cursor-pointer" data-icon="star">
						star
					</span>
				</div>
				<div className="flex items-center gap-4">
					<div className="flex -space-x-2">
						{PRESENCE_MEMBERS.slice(0, 2).map((member, index) => (
							<React.Fragment key={member.id}>
								{member.avatar ? (
									<img
										className="w-8 h-8 rounded-full border-2 border-white object-cover"
										src={member.avatar}
										alt={`${member.name} avatar`}
									/>
								) : (
									<div className="w-8 h-8 rounded-full border-2 border-white bg-[#E5E5EA] text-[#1D1D1F] text-[10px] flex items-center justify-center font-bold">
										{member.initials || member.name.slice(0, 2).toUpperCase()}
									</div>
								)}
							</React.Fragment>
						))}
						<div className="w-8 h-8 rounded-full border-2 border-white bg-[#E5E5EA] text-[#1D1D1F] text-[11px] flex items-center justify-center font-bold">
							+12
						</div>
					</div>
					<span className="material-symbols-outlined text-[#1D1D1F] opacity-60 text-[22px] cursor-pointer hover:opacity-100 transition-colors" data-icon="help">
						help
					</span>
					<span className="material-symbols-outlined text-[#1D1D1F] opacity-60 text-[22px] cursor-pointer hover:opacity-100 transition-colors" data-icon="settings">
						settings
					</span>
				</div>
			</header>

			{/* Message Area */}
			<div className="flex-1 overflow-y-auto px-10 pt-8 pb-4 flex flex-col gap-6 scroll-smooth custom-scrollbar">
				{/* Date Divider */}
				<div className="relative flex justify-center items-center mt-2 mb-4">
					<div className="absolute inset-0 flex items-center">
						<div className="w-full border-t border-black/5" />
					</div>
					<span className="relative px-4 bg-white text-[11px] font-bold text-[#1D1D1F] opacity-60 tracking-widest uppercase">
						TODAY
					</span>
				</div>

				{trimmedMessages.map((message, index) => (
					<Message
						key={message.id}
						message={message}
						index={index}
						onReaction={(messageId, emoji) => onReactMessage(activeChannel, messageId, emoji)}
					/>
				))}

				{showNudge ? (
					<div className="bg-[#E1F0FF] px-4 py-3 flex items-start gap-4 rounded-[8px] w-full max-w-[85%] self-start border-l-4 border-l-[#0f67b7]">
						<span className="material-symbols-outlined text-[#0f67b7] text-[20px] mt-0.5" data-icon="info">
							info
						</span>
						<div className="flex flex-1 justify-between items-center pr-2">
							<p className="text-[13px] text-[#003B73] font-medium leading-relaxed">
								Try rephrasing for better clarity. Your last message has a formal tone that might be perceived as rigid in this context.
							</p>
							<button
								className="text-[12px] font-bold uppercase tracking-widest text-[#0b4b8a] hover:underline"
								onClick={() => setShowNudge(false)}
							>
								DISMISS
							</button>
						</div>
					</div>
				) : null}

				<div className="flex items-center gap-2 px-14 opacity-50 mb-2">
					<div className="flex gap-1" aria-hidden="true">
						<span className="w-1 h-1 rounded-full bg-[#1D1D1F] animate-pulse" />
						<span className="w-1 h-1 rounded-full bg-[#1D1D1F] animate-pulse delay-75" />
						<span className="w-1 h-1 rounded-full bg-[#1D1D1F] animate-pulse delay-150" />
					</div>
					<span className="text-[12px] italic text-[#1D1D1F]">Alex is typing...</span>
				</div>
			</div>

			{/* Message Input Area */}
			<footer className="px-10 pb-8 bg-white mt-auto">
				<div className="w-full space-y-3">
					{/* Sentiment Bar */}
					<div className="flex items-center gap-4 px-2 w-full max-w-full">
						<span className="text-[10px] font-bold text-[#1D1D1F] opacity-70 uppercase tracking-widest whitespace-nowrap">
							TONE SENTIMENT
						</span>
						<div className="flex-1 h-[6px] bg-[#E5E5EA] rounded-full overflow-hidden flex">
							<div
								className="h-full bg-[#0f67b7] transition-all duration-500 rounded-full"
								style={{ width: `70%` }}
							/>
						</div>
						<span className="text-[12px] font-bold text-[#0f67b7]">Collaborative</span>
					</div>

					{/* Input Box */}
					<div className="bg-white rounded-[12px] shadow-[0_2px_12px_rgba(0,0,0,0.06)] border border-[#E5E5EA] p-3 focus-within:ring-2 focus-within:ring-[#0f67b7]/20 transition-all flex flex-col">
						<textarea
							value={inputValue}
							onChange={(event) => setInputValue(event.target.value)}
							className="w-full border-none focus:outline-none focus:ring-0 text-[14px] text-[#1D1D1F] px-1 bg-transparent resize-none placeholder:text-[#1D1D1F] placeholder:opacity-50"
							placeholder={`Type a message to #${String(activeChannel || "product-strategy").replace(/^#/, "")}`}
							rows={1}
							onKeyDown={(event) => {
								if (event.key === "Enter" && !event.shiftKey) {
									event.preventDefault();
									sendMessage();
								}
							}}
						/>
						<div className="flex items-center justify-between mt-6">
							<div className="flex items-center gap-3 pl-1">
								<span className="material-symbols-outlined text-[24px] text-[#1D1D1F] opacity-70 hover:opacity-100 cursor-pointer" data-icon="add_circle">add_circle</span>
								<span className="material-symbols-outlined text-[24px] text-[#1D1D1F] opacity-70 hover:opacity-100 cursor-pointer" data-icon="sentiment_satisfied">sentiment_satisfied</span>
								<span className="material-symbols-outlined text-[24px] text-[#1D1D1F] opacity-70 hover:opacity-100 cursor-pointer" data-icon="alternate_email">alternate_email</span>
								
								<div className="flex items-center gap-3 ml-2 border-l border-black/10 pl-5">
									<span className="material-symbols-outlined text-[20px] text-[#1D1D1F] opacity-70" data-icon="translate">translate</span>
									<span className="text-[12px] font-semibold text-[#1D1D1F] opacity-80 uppercase tracking-widest tracking-tighter">TRANSLATE</span>
									
									<button
										type="button"
										className={`w-[32px] h-[18px] rounded-full relative cursor-pointer border ${translateEnabled ? 'bg-[#34C759] border-[#34C759]' : 'bg-[#E5E5EA] border-[#D1D1D6]'}`}
										onClick={() => setTranslateEnabled((current) => !current)}
										aria-pressed={translateEnabled}
									>
										<div className={`absolute top-[1px] w-[14px] h-[14px] rounded-full bg-white shadow-sm transition-all duration-200 ${translateEnabled ? "right-[1px]" : "left-[1px]"}`} />
									</button>
								</div>
							</div>

							<button
                                                                className={`bg-[#0f67b7] text-white pl-4 pr-3 py-[6px] rounded-[16px] text-[14px] font-semibold flex items-center justify-center gap-1.5 hover:bg-[#0b4b8a] transition-all cursor-pointer shadow-sm ${isSending ? "opacity-75 cursor-wait" : "active:scale-95"}`}
                                                                onClick={sendMessage}
                                                                disabled={isSending}
                                                                aria-label={isSending ? "Sending message..." : "Send message"}
                                                                type="button"
                                                        >
                                                                <span>{isSending ? "Sending..." : "Send"}</span>
                                                                {isSending ? <span className="material-symbols-outlined text-[16px] animate-spin" data-icon="sync">sync</span> : <span className="material-symbols-outlined text-[16px]" data-icon="send">send</span>}
                                                        </button>
						</div>
					</div>
				</div>
			</footer>
		</div>
	);
}
