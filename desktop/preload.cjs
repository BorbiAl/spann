const { contextBridge } = require("electron");

// Runtime API base override for native desktop builds.
contextBridge.exposeInMainWorld("SPANN_API_BASE", process.env.SPANN_API_BASE || "");
