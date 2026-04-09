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
