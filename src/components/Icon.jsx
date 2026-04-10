import React from "react";

export default function Icon({ name, size = 20 }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  };

  if (name === "chat") {
    return (
      <svg {...common}>
        <path d="M4 6.5a2.5 2.5 0 0 1 2.5-2.5h11A2.5 2.5 0 0 1 20 6.5v6A2.5 2.5 0 0 1 17.5 15H11l-4.5 4v-4H6.5A2.5 2.5 0 0 1 4 12.5z" />
      </svg>
    );
  }

  if (name === "hub") {
    return (
      <svg {...common}>
        <rect x="4" y="4" width="16" height="16" rx="4" />
        <circle cx="8" cy="8" r="1.3" fill="currentColor" stroke="none" />
        <circle cx="16" cy="8" r="1.3" fill="currentColor" stroke="none" />
        <circle cx="8" cy="16" r="1.3" fill="currentColor" stroke="none" />
        <circle cx="16" cy="16" r="1.3" fill="currentColor" stroke="none" />
        <path d="M8 8h8M8 16h8M8 8v8M16 8v8" />
      </svg>
    );
  }

  if (name === "security") {
    return (
      <svg {...common}>
        <path d="M12 3.5l6 2.5v5.8c0 4.2-2.5 7.4-6 8.7-3.5-1.3-6-4.5-6-8.7V6z" />
        <path d="M9.2 12.2l1.8 1.8 3.8-3.8" />
      </svg>
    );
  }

  if (name === "bolt") {
    return (
      <svg {...common}>
        <path d="M13.8 2.8L6.7 13h4.2L9.8 21.2 17.3 10h-4.1z" />
      </svg>
    );
  }

  if (name === "tower") {
    return (
      <svg {...common}>
        <path d="M12 4v16" />
        <path d="M9 20h6" />
        <path d="M12 4l4 8h-8z" />
        <path d="M5.2 7.5a8 8 0 0 1 2-2.2" />
        <path d="M18.8 7.5a8 8 0 0 0-2-2.2" />
        <path d="M3.3 11a11 11 0 0 1 3.1-4.1" />
        <path d="M20.7 11a11 11 0 0 0-3.1-4.1" />
      </svg>
    );
  }

  if (name === "leaf") {
    return (
      <svg {...common}>
        <path d="M5 14c0-5 4.5-9 12-10 0 8-4 14-10 14-1.1 0-2-.9-2-2z" />
        <path d="M8 16c2.5-1 4.5-3 7-7" />
      </svg>
    );
  }

  if (name === "walk") {
    return (
      <svg {...common}>
        <circle cx="13" cy="4.8" r="1.8" />
        <path d="M12.2 7.2l-1.6 4.2 2.4 1.6" />
        <path d="M10.6 11.4l-3 2.6" />
        <path d="M13 13l2.4 2.8" />
        <path d="M9.8 17.8l-2.2 2.8" />
        <path d="M15.8 15.8l1.8 3.8" />
      </svg>
    );
  }

  if (name === "bike") {
    return (
      <svg {...common}>
        <circle cx="6" cy="16" r="3" />
        <circle cx="18" cy="16" r="3" />
        <path d="M9 16l3-6 3 6" />
        <path d="M12 10h3" />
        <path d="M10.5 10H8.6" />
      </svg>
    );
  }

  if (name === "bus") {
    return (
      <svg {...common}>
        <rect x="4" y="5" width="16" height="12" rx="3" />
        <path d="M8 17v2" />
        <path d="M16 17v2" />
        <circle cx="8" cy="14" r="1" fill="currentColor" stroke="none" />
        <circle cx="16" cy="14" r="1" fill="currentColor" stroke="none" />
        <path d="M4 10h16" />
      </svg>
    );
  }

  if (name === "train") {
    return (
      <svg {...common}>
        <rect x="6" y="4" width="12" height="13" rx="3" />
        <path d="M10 17l-2 3" />
        <path d="M14 17l2 3" />
        <path d="M6 12h12" />
        <circle cx="9.5" cy="9" r="1" fill="currentColor" stroke="none" />
        <circle cx="14.5" cy="9" r="1" fill="currentColor" stroke="none" />
      </svg>
    );
  }

  if (name === "forest") {
    return (
      <svg {...common}>
        <path d="M7 19l3-6H8l3.2-5.5L14.4 13h-2l3 6z" />
        <path d="M14 19l2.5-4.5H15l2.5-4 2.5 4h-1.5L21 19z" />
      </svg>
    );
  }

  if (name === "lock") {
    return (
      <svg {...common}>
        <rect x="6" y="11" width="12" height="9" rx="2" />
        <path d="M9 11V8a3 3 0 0 1 6 0v3" />
      </svg>
    );
  }

  if (name === "wave") {
    return (
      <svg {...common}>
        <path d="M3 12h2l1.5-4 3 8 2.5-6L14 14l2-5 2 3h3" />
      </svg>
    );
  }

  if (name === "eye") {
    return (
      <svg {...common}>
        <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }

  if (name === "globe") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18" />
        <path d="M12 3a13 13 0 0 1 0 18" />
        <path d="M12 3a13 13 0 0 0 0 18" />
      </svg>
    );
  }

  if (name === "search") {
    return (
      <svg {...common}>
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.6-3.6" />
      </svg>
    );
  }

  if (name === "add") {
    return (
      <svg {...common}>
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </svg>
    );
  }

  if (name === "tag") {
    return (
      <svg {...common}>
        <path d="M4.5 11.5l7-7H19.5v8l-7 7-8-8z" />
        <circle cx="15.4" cy="8.6" r="1.2" fill="currentColor" stroke="none" />
      </svg>
    );
  }

  if (name === "lan") {
    return (
      <svg {...common}>
        <rect x="3" y="5" width="6" height="4" rx="1" />
        <rect x="15" y="5" width="6" height="4" rx="1" />
        <rect x="9" y="15" width="6" height="4" rx="1" />
        <path d="M6 9v3h12V9" />
        <path d="M12 12v3" />
      </svg>
    );
  }

  if (name === "eco") {
    return (
      <svg {...common}>
        <path d="M5 14c0-5 4.5-9 12-10 0 8-4 14-10 14-1.1 0-2-.9-2-2z" />
        <path d="M8 16c2.5-1 4.5-3 7-7" />
      </svg>
    );
  }

  if (name === "insert_chart") {
    return (
      <svg {...common}>
        <rect x="4" y="4" width="16" height="16" rx="3" />
        <path d="M8 15V11" />
        <path d="M12 15V8" />
        <path d="M16 15v-3" />
      </svg>
    );
  }

  if (name === "accessibility_new") {
    return (
      <svg {...common}>
        <circle cx="12" cy="5" r="2" />
        <path d="M6 10l6 2 6-2" />
        <path d="M12 12v8" />
        <path d="M9 20l3-4 3 4" />
      </svg>
    );
  }

  if (name === "translate") {
    return (
      <svg {...common}>
        <path d="M4 6h9" />
        <path d="M8.5 6c0 5-2 8-4.5 10" />
        <path d="M6.5 12.5c1.4 1.5 3.1 2.8 5.5 3.8" />
        <path d="M14 9h6" />
        <path d="M17 9v10" />
        <path d="M14.5 16h5" />
      </svg>
    );
  }

  if (name === "contact_support") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M9.8 9a2.3 2.3 0 0 1 4.4.9c0 1.7-2.2 2.1-2.2 3.6" />
        <circle cx="12" cy="16.8" r="0.9" fill="currentColor" stroke="none" />
      </svg>
    );
  }

  if (name === "forum") {
    return (
      <svg {...common}>
        <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h8A2.5 2.5 0 0 1 17 6.5v4A2.5 2.5 0 0 1 14.5 13H10l-3.5 3.2V13H6.5A2.5 2.5 0 0 1 4 10.5z" />
        <path d="M13 10.5A2.5 2.5 0 0 0 15.5 13H17v2.8l3-2.8h.5A2.5 2.5 0 0 0 23 10.5v-4A2.5 2.5 0 0 0 20.5 4H17" />
      </svg>
    );
  }

  if (name === "person_search") {
    return (
      <svg {...common}>
        <circle cx="10" cy="9" r="3" />
        <path d="M4.5 18c1.4-2.3 3.2-3.5 5.5-3.5" />
        <circle cx="17" cy="16" r="3" />
        <path d="M19.2 18.2L22 21" />
      </svg>
    );
  }

  if (name === "folder_open") {
    return (
      <svg {...common}>
        <path d="M3.5 7.5a2 2 0 0 1 2-2h4l1.6 1.6h7.4a2 2 0 0 1 2 2v1.4" />
        <path d="M3 10.5h18l-2 8.5H5z" />
      </svg>
    );
  }

  if (name === "keyboard_double_arrow_right") {
    return (
      <svg {...common}>
        <path d="M8 7l5 5-5 5" />
        <path d="M13 7l5 5-5 5" />
      </svg>
    );
  }

  if (name === "info") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 10v6" />
        <circle cx="12" cy="7" r="1" fill="currentColor" stroke="none" />
      </svg>
    );
  }

  if (name === "star") {
    return (
      <svg {...common}>
        <path d="M12 3.8l2.6 5.3 5.8.8-4.2 4 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.2-4 5.8-.8z" />
      </svg>
    );
  }

  if (name === "help") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M9.8 9a2.3 2.3 0 0 1 4.4.9c0 1.7-2.2 2.1-2.2 3.6" />
        <circle cx="12" cy="16.8" r="0.9" fill="currentColor" stroke="none" />
      </svg>
    );
  }

  if (name === "settings") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="2.4" />
        <path d="M19.2 12a7.4 7.4 0 0 0-.1-1l2-1.5-1.8-3.1-2.4 1a7.7 7.7 0 0 0-1.7-1l-.3-2.6h-3.6l-.3 2.6a7.7 7.7 0 0 0-1.7 1l-2.4-1-1.8 3.1 2 1.5a7.4 7.4 0 0 0 0 2l-2 1.5 1.8 3.1 2.4-1a7.7 7.7 0 0 0 1.7 1l.3 2.6h3.6l.3-2.6a7.7 7.7 0 0 0 1.7-1l2.4 1 1.8-3.1-2-1.5c.1-.3.1-.6.1-1z" />
      </svg>
    );
  }

  if (name === "plusCircle") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v8" />
        <path d="M8 12h8" />
      </svg>
    );
  }

  if (name === "mention") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="8" />
        <path d="M16 13.5V12a4 4 0 1 0-1.2 2.9" />
        <path d="M16 13.5a1.5 1.5 0 0 0 3 0v-2.2" />
      </svg>
    );
  }

  if (name === "threads") {
    return (
      <svg {...common}>
        <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v6A2.5 2.5 0 0 1 17.5 15H11l-4.5 4v-4H6.5A2.5 2.5 0 0 1 4 12.5z" />
        <path d="M8 8.8h8" />
        <path d="M8 11.8h5" />
      </svg>
    );
  }

  if (name === "mentions") {
    return (
      <svg {...common}>
        <circle cx="10" cy="10" r="3.5" />
        <path d="M3 19c1.8-2.4 4.2-3.6 7-3.6" />
        <path d="M14.5 5.5l1.8-1.8" />
        <path d="M15.8 10.2h2.6" />
        <path d="M14.5 14.8l1.8 1.8" />
      </svg>
    );
  }

  if (name === "folder") {
    return (
      <svg {...common}>
        <path d="M3.5 7.5a2 2 0 0 1 2-2h4l1.6 1.6h7.4a2 2 0 0 1 2 2v7.4a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />
      </svg>
    );
  }

  if (name === "chevronDoubleRight") {
    return (
      <svg {...common}>
        <path d="M8 7l5 5-5 5" />
        <path d="M13 7l5 5-5 5" />
      </svg>
    );
  }

  if (name === "sun") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2" />
        <path d="M12 20v2" />
        <path d="M4.9 4.9l1.4 1.4" />
        <path d="M17.7 17.7l1.4 1.4" />
        <path d="M2 12h2" />
        <path d="M20 12h2" />
        <path d="M4.9 19.1l1.4-1.4" />
        <path d="M17.7 6.3l1.4-1.4" />
      </svg>
    );
  }

  if (name === "moon") {
    return (
      <svg {...common}>
        <path d="M21 13.2A8.5 8.5 0 1 1 10.8 3 6.8 6.8 0 0 0 21 13.2z" />
      </svg>
    );
  }

  if (name === "panel") {
    return (
      <svg {...common}>
        <rect x="3" y="4" width="18" height="16" rx="3" />
        <path d="M9 4v16" />
      </svg>
    );
  }

  if (name === "attach") {
    return (
      <svg {...common}>
        <path d="M8 12.5l5.2-5.2a3 3 0 0 1 4.2 4.2l-6.3 6.3a4.5 4.5 0 0 1-6.4-6.4l6-6" />
      </svg>
    );
  }

  if (name === "emoji") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M8 14s1.2 2 4 2 4-2 4-2" />
        <circle cx="9" cy="10" r="1" />
        <circle cx="15" cy="10" r="1" />
      </svg>
    );
  }

  if (name === "mic") {
    return (
      <svg {...common}>
        <rect x="9" y="4" width="6" height="11" rx="3" />
        <path d="M6 11a6 6 0 1 0 12 0" />
        <path d="M12 17v3" />
      </svg>
    );
  }

  if (name === "attach_file") {
    return (
      <svg {...common}>
        <path d="M8 12.5l5.2-5.2a3 3 0 0 1 4.2 4.2l-6.3 6.3a4.5 4.5 0 0 1-6.4-6.4l6-6" />
      </svg>
    );
  }

  if (name === "swap_horiz") {
    return (
      <svg {...common}>
        <path d="M7 8h11" />
        <path d="M15 5l3 3-3 3" />
        <path d="M17 16H6" />
        <path d="M9 13l-3 3 3 3" />
      </svg>
    );
  }

  if (name === "arrow_forward") {
    return (
      <svg {...common}>
        <path d="M5 12h14" />
        <path d="M13 7l6 5-6 5" />
      </svg>
    );
  }

  if (name === "lightbulb") {
    return (
      <svg {...common}>
        <path d="M9.5 18h5" />
        <path d="M10 21h4" />
        <path d="M8 10a4 4 0 1 1 8 0c0 1.7-.8 2.6-1.8 3.7-.8.8-1.2 1.5-1.2 2.3h-2c0-.8-.4-1.5-1.2-2.3C8.8 12.6 8 11.7 8 10z" />
      </svg>
    );
  }

  if (name === "auto_awesome") {
    return (
      <svg {...common}>
        <path d="M12 4.5l1.6 3.3 3.6.5-2.6 2.5.6 3.7-3.2-1.7-3.2 1.7.6-3.7-2.6-2.5 3.6-.5z" />
        <path d="M18.5 4.5v2" />
        <path d="M17.5 5.5h2" />
        <path d="M19.5 12.5v1.5" />
        <path d="M18.75 13.25h1.5" />
      </svg>
    );
  }

  if (name === "send") {
    return (
      <svg {...common}>
        <path d="M3 11.8L20 4l-5.2 16-3.5-6.5z" />
      </svg>
    );
  }

  if (name === "close") {
    return (
      <svg {...common}>
        <path d="M6 6l12 12" />
        <path d="M18 6L6 18" />
      </svg>
    );
  }

  if (name === "logout") {
    return (
      <svg {...common}>
        <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
        <path d="M10 17l5-5-5-5" />
        <path d="M15 12H4" />
      </svg>
    );
  }

  return null;
}
