import { useState, useEffect, useRef, useCallback } from "react";

const COLS = 12;
const ROWS = 14;

function createEmptyGrid() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function getNextPosition(row, col, direction, rows) {
  const nextRow = direction === "up" ? row - 1 : row + 1;
  if (nextRow < 0 || nextRow >= rows) return null; // column full
  return { row: nextRow, col };
}

export default function App() {
  const [grid, setGrid] = useState(createEmptyGrid());
  const [currentCol, setCurrentCol] = useState(0);
  const [currentRow, setCurrentRow] = useState(ROWS - 1);
  const [direction, setDirection] = useState("up"); // "up" = south→north
  const [stats, setStats] = useState({ total: 0, good: 0, bad: 0 });
  const [wsUrl, setWsUrl] = useState("ws://192.168.1.100:81");
  const [wsStatus, setWsStatus] = useState("disconnected"); // "disconnected" | "connecting" | "connected" | "error"
  const [log, setLog] = useState([]);
  const [fieldName, setFieldName] = useState("Field A-01");
  const [colFull, setColFull] = useState(false);
  const wsRef = useRef(null);
  const logRef = useRef(null);

  const addLog = useCallback((msg, type = "info") => {
    const time = new Date().toLocaleTimeString("en-IN", { hour12: false });
    setLog(prev => [...prev.slice(-49), { msg, type, time }]);
  }, []);

  // Plant crop at current position
  const plantCrop = useCallback(() => {
    setGrid(prev => {
      const next = prev.map(r => [...r]);
      if (next[currentRow][currentCol] !== null) return prev;
      const quality = Math.random() > 0.3 ? "good" : "bad";
      next[currentRow][currentCol] = quality;
      return next;
    });

    const quality = Math.random() > 0.3 ? "good" : "bad";
    setStats(prev => ({
      total: prev.total + 1,
      good: prev.good + (quality === "good" ? 1 : 0),
      bad: prev.bad + (quality === "bad" ? 1 : 0),
    }));
    addLog(`Plant at col ${currentCol + 1}, row ${ROWS - currentRow} → ${quality.toUpperCase()}`, quality === "good" ? "good" : "bad");

    // Advance position
    const next = getNextPosition(currentRow, currentCol, direction, ROWS);
    if (next) {
      setCurrentRow(next.row);
      setColFull(false);
    } else {
      setColFull(true);
      addLog(`Column ${currentCol + 1} is full. Trigger Sensor 2 to advance.`, "warn");
    }
  }, [currentRow, currentCol, direction, addLog]);

  // Advance to next column
  const nextColumn = useCallback(() => {
    const nextCol = currentCol + 1;
    if (nextCol >= COLS) {
      addLog("All columns filled! Field complete.", "warn");
      return;
    }
    const newDirection = direction === "up" ? "down" : "up";
    const newRow = newDirection === "up" ? ROWS - 1 : 0;
    setCurrentCol(nextCol);
    setDirection(newDirection);
    setCurrentRow(newRow);
    setColFull(false);
    addLog(`→ Column ${nextCol + 1} | Direction: ${newDirection === "up" ? "S→N" : "N→S"}`, "info");
  }, [currentCol, direction, addLog]);

  // WebSocket connection
  const connectWs = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setWsStatus("connecting");
    addLog(`Connecting to ${wsUrl}...`, "info");
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      ws.onopen = () => {
        setWsStatus("connected");
        addLog("ESP32 connected!", "good");
      };
      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.sensor === 1) plantCrop();
          if (data.sensor === 2) nextColumn();
        } catch {
          addLog(`Raw: ${e.data}`, "info");
        }
      };
      ws.onerror = () => {
        setWsStatus("error");
        addLog("Connection error.", "bad");
      };
      ws.onclose = () => {
        setWsStatus("disconnected");
        addLog("ESP32 disconnected.", "warn");
      };
    } catch {
      setWsStatus("error");
      addLog("Invalid WebSocket URL.", "bad");
    }
  }, [wsUrl, plantCrop, nextColumn, addLog]);

  const disconnectWs = () => {
    if (wsRef.current) wsRef.current.close();
    setWsStatus("disconnected");
  };

  const resetField = () => {
    setGrid(createEmptyGrid());
    setCurrentCol(0);
    setCurrentRow(ROWS - 1);
    setDirection("up");
    setStats({ total: 0, good: 0, bad: 0 });
    setColFull(false);
    addLog("Field reset.", "warn");
  };

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  const goodPct = stats.total > 0 ? Math.round((stats.good / stats.total) * 100) : 0;
  const filledCells = stats.total;
  const totalCells = ROWS * COLS;

  const statusColor = {
    connected: "#22c55e",
    connecting: "#f59e0b",
    disconnected: "#6b7280",
    error: "#ef4444",
  }[wsStatus];

  const statusLabel = {
    connected: "CONNECTED",
    connecting: "CONNECTING...",
    disconnected: "DISCONNECTED",
    error: "ERROR",
  }[wsStatus];

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0f0a",
      color: "#e2e8d5",
      fontFamily: "'Courier New', 'Lucida Console', monospace",
      padding: "16px",
      display: "flex",
      flexDirection: "column",
      gap: "12px",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #1e3320", paddingBottom: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: 36, height: 36, border: "2px solid #4ade80", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 2, padding: 4 }}>
            {[...Array(9)].map((_, i) => (
              <div key={i} style={{ background: i % 3 === 0 ? "#4ade80" : "#1e3320", borderRadius: 1 }} />
            ))}
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: "bold", color: "#4ade80", letterSpacing: 2 }}>FIELDMAP ESP32</div>
            <div style={{ fontSize: 10, color: "#6b7280", letterSpacing: 3 }}>AGRICULTURAL GRID SYSTEM</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, color: "#6b7280", letterSpacing: 2 }}>FIELD ID</div>
            <input
              value={fieldName}
              onChange={e => setFieldName(e.target.value)}
              style={{ background: "transparent", border: "none", color: "#a3e635", fontSize: 13, fontFamily: "inherit", fontWeight: "bold", textAlign: "right", outline: "none", width: 100 }}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: statusColor, boxShadow: wsStatus === "connected" ? `0 0 8px ${statusColor}` : "none", animation: wsStatus === "connecting" ? "pulse 1s infinite" : "none" }} />
            <span style={{ fontSize: 11, color: statusColor, letterSpacing: 2 }}>{statusLabel}</span>
          </div>
        </div>
      </div>

      {/* Main layout */}
      <div style={{ display: "flex", gap: "12px", flex: 1, flexWrap: "wrap" }}>

        {/* Left panel: grid */}
        <div style={{ flex: "1 1 auto", display: "flex", flexDirection: "column", gap: 8, minWidth: 300 }}>
          {/* Grid header labels */}
          <div style={{ display: "flex", alignItems: "center", gap: 4, paddingLeft: 28 }}>
            {Array.from({ length: COLS }, (_, c) => (
              <div key={c} style={{
                width: 32, height: 16, textAlign: "center", fontSize: 9, color: c === currentCol ? "#4ade80" : "#374151",
                fontWeight: c === currentCol ? "bold" : "normal",
                borderBottom: c === currentCol ? "2px solid #4ade80" : "2px solid transparent",
              }}>{c + 1}</div>
            ))}
          </div>

          {/* Grid rows */}
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {Array.from({ length: ROWS }, (_, r) => (
              <div key={r} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 24, textAlign: "right", fontSize: 9, color: "#374151", marginRight: 4 }}>
                  {ROWS - r}
                </div>
                {Array.from({ length: COLS }, (_, c) => {
                  const val = grid[r][c];
                  const isCurrent = r === currentRow && c === currentCol;
                  const isActiveCol = c === currentCol;
                  return (
                    <div key={c} style={{
                      width: 32,
                      height: 32,
                      border: isCurrent
                        ? "2px solid #facc15"
                        : isActiveCol
                          ? "1px solid #1e4d2e"
                          : "1px solid #111b11",
                      borderRadius: 3,
                      background: isCurrent ? "#1a2e1a" : isActiveCol ? "#0e1f10" : "#0c150c",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "all 0.15s",
                      position: "relative",
                    }}>
                      {val && (
                        <div style={{
                          width: 16,
                          height: 16,
                          borderRadius: "50%",
                          background: val === "good" ? "#22c55e" : "#ef4444",
                          boxShadow: val === "good" ? "0 0 6px #22c55e88" : "0 0 6px #ef444488",
                          animation: "popIn 0.2s ease-out",
                        }} />
                      )}
                      {isCurrent && !val && (
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#facc1566", animation: "blink 1s infinite" }} />
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Direction indicator */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 4, paddingLeft: 28 }}>
            <div style={{ fontSize: 10, color: "#6b7280", letterSpacing: 1 }}>
              COL {currentCol + 1} · {direction === "up" ? "↑ S→N" : "↓ N→S"} · ROW {ROWS - currentRow}
            </div>
            {colFull && <div style={{ fontSize: 10, color: "#f59e0b", letterSpacing: 1 }}>⚠ COL FULL — TRIGGER SENSOR 2</div>}
          </div>
        </div>

        {/* Right panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 220, maxWidth: 280 }}>

          {/* Stats */}
          <div style={{ border: "1px solid #1e3320", borderRadius: 6, padding: "12px 14px", background: "#0c150c" }}>
            <div style={{ fontSize: 10, color: "#4ade80", letterSpacing: 3, marginBottom: 10 }}>STATISTICS</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[
                { label: "TOTAL", val: stats.total, color: "#a3e635" },
                { label: "GOOD", val: stats.good, color: "#22c55e" },
                { label: "BAD", val: stats.bad, color: "#ef4444" },
                { label: "YIELD %", val: `${goodPct}%`, color: goodPct > 70 ? "#22c55e" : goodPct > 40 ? "#f59e0b" : "#ef4444" },
              ].map(s => (
                <div key={s.label} style={{ background: "#111b11", borderRadius: 4, padding: "8px 10px" }}>
                  <div style={{ fontSize: 9, color: "#4b5563", letterSpacing: 2 }}>{s.label}</div>
                  <div style={{ fontSize: 22, fontWeight: "bold", color: s.color, lineHeight: 1.2 }}>{s.val}</div>
                </div>
              ))}
            </div>
            {/* Progress bar */}
            <div style={{ marginTop: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#4b5563", marginBottom: 4 }}>
                <span>FIELD COVERAGE</span>
                <span>{Math.round((filledCells / totalCells) * 100)}%</span>
              </div>
              <div style={{ height: 6, background: "#111b11", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${(filledCells / totalCells) * 100}%`, background: "linear-gradient(90deg, #22c55e, #a3e635)", borderRadius: 3, transition: "width 0.3s" }} />
              </div>
            </div>
            {/* Good/Bad split bar */}
            {stats.total > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#4b5563", marginBottom: 4 }}>
                  <span style={{ color: "#22c55e" }}>● GOOD {goodPct}%</span>
                  <span style={{ color: "#ef4444" }}>● BAD {100 - goodPct}%</span>
                </div>
                <div style={{ height: 6, background: "#ef4444", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${goodPct}%`, background: "#22c55e", borderRadius: 3, transition: "width 0.3s" }} />
                </div>
              </div>
            )}
          </div>

          {/* Manual Controls */}
          <div style={{ border: "1px solid #1e3320", borderRadius: 6, padding: "12px 14px", background: "#0c150c" }}>
            <div style={{ fontSize: 10, color: "#4ade80", letterSpacing: 3, marginBottom: 10 }}>MANUAL OVERRIDE</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button onClick={plantCrop} style={{
                background: "transparent", border: "1px solid #22c55e", color: "#22c55e", padding: "10px 0",
                borderRadius: 4, cursor: "pointer", fontFamily: "inherit", fontSize: 11, letterSpacing: 2,
                transition: "all 0.15s",
              }}
                onMouseOver={e => { e.target.style.background = "#22c55e22"; }}
                onMouseOut={e => { e.target.style.background = "transparent"; }}>
                ▶ SENSOR 1 — PLANT
              </button>
              <button onClick={nextColumn} style={{
                background: "transparent", border: "1px solid #60a5fa", color: "#60a5fa", padding: "10px 0",
                borderRadius: 4, cursor: "pointer", fontFamily: "inherit", fontSize: 11, letterSpacing: 2,
                transition: "all 0.15s",
              }}
                onMouseOver={e => { e.target.style.background = "#60a5fa22"; }}
                onMouseOut={e => { e.target.style.background = "transparent"; }}>
                ▶ SENSOR 2 — NEXT COL
              </button>
              <button onClick={resetField} style={{
                background: "transparent", border: "1px solid #374151", color: "#6b7280", padding: "8px 0",
                borderRadius: 4, cursor: "pointer", fontFamily: "inherit", fontSize: 10, letterSpacing: 2,
                transition: "all 0.15s",
              }}
                onMouseOver={e => { e.target.style.background = "#37415122"; }}
                onMouseOut={e => { e.target.style.background = "transparent"; }}>
                ↺ RESET FIELD
              </button>
            </div>
          </div>

          {/* WebSocket config */}
          <div style={{ border: "1px solid #1e3320", borderRadius: 6, padding: "12px 14px", background: "#0c150c" }}>
            <div style={{ fontSize: 10, color: "#4ade80", letterSpacing: 3, marginBottom: 10 }}>ESP32 CONNECTION</div>
            <div style={{ fontSize: 9, color: "#6b7280", marginBottom: 4, letterSpacing: 1 }}>WEBSOCKET URL</div>
            <input
              value={wsUrl}
              onChange={e => setWsUrl(e.target.value)}
              style={{
                width: "100%", background: "#111b11", border: "1px solid #1e3320", color: "#a3e635",
                padding: "7px 8px", borderRadius: 3, fontFamily: "inherit", fontSize: 11, outline: "none",
                boxSizing: "border-box", marginBottom: 8,
              }}
              placeholder="ws://192.168.x.x:81"
            />
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={connectWs} disabled={wsStatus === "connected"} style={{
                flex: 1, background: wsStatus === "connected" ? "#1e3320" : "transparent",
                border: "1px solid #22c55e", color: wsStatus === "connected" ? "#4ade80" : "#22c55e",
                padding: "7px 0", borderRadius: 3, cursor: wsStatus === "connected" ? "default" : "pointer",
                fontFamily: "inherit", fontSize: 10, letterSpacing: 1,
              }}>CONNECT</button>
              <button onClick={disconnectWs} disabled={wsStatus === "disconnected"} style={{
                flex: 1, background: "transparent", border: "1px solid #374151", color: "#6b7280",
                padding: "7px 0", borderRadius: 3, cursor: wsStatus === "disconnected" ? "default" : "pointer",
                fontFamily: "inherit", fontSize: 10, letterSpacing: 1,
              }}>DISCONNECT</button>
            </div>
            <div style={{ marginTop: 8, fontSize: 9, color: "#374151", lineHeight: 1.6 }}>
              ESP32 must send:<br />
              <span style={{ color: "#4b5563" }}>{"{"}"sensor":1{"}"}</span> → Plant<br />
              <span style={{ color: "#4b5563" }}>{"{"}"sensor":2{"}"}</span> → Next Column
            </div>
          </div>

          {/* Legend */}
          <div style={{ border: "1px solid #1e3320", borderRadius: 6, padding: "10px 14px", background: "#0c150c" }}>
            <div style={{ fontSize: 10, color: "#4ade80", letterSpacing: 3, marginBottom: 8 }}>LEGEND</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {[
                { color: "#22c55e", shadow: "#22c55e88", label: "GOOD CROP" },
                { color: "#ef4444", shadow: "#ef444488", label: "BAD CROP" },
                { color: "#facc15", shadow: "#facc1588", label: "CURSOR (NEXT PLANT)" },
              ].map(l => (
                <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 12, height: 12, borderRadius: "50%", background: l.color, boxShadow: `0 0 5px ${l.shadow}` }} />
                  <span style={{ fontSize: 10, color: "#6b7280", letterSpacing: 1 }}>{l.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Activity log */}
      <div style={{ border: "1px solid #1e3320", borderRadius: 6, padding: "10px 14px", background: "#0c150c", maxHeight: 120, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: 10, color: "#4ade80", letterSpacing: 3, marginBottom: 6 }}>ACTIVITY LOG</div>
        <div ref={logRef} style={{ overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
          {log.length === 0 && <div style={{ fontSize: 10, color: "#374151" }}>No activity yet. Use manual controls or connect ESP32.</div>}
          {log.map((l, i) => (
            <div key={i} style={{ fontSize: 10, display: "flex", gap: 10, color: { good: "#22c55e", bad: "#ef4444", warn: "#f59e0b", info: "#6b7280" }[l.type] }}>
              <span style={{ color: "#374151", flexShrink: 0 }}>{l.time}</span>
              <span>{l.msg}</span>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes popIn {
          from { transform: scale(0); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.2; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #0a0f0a; }
        ::-webkit-scrollbar-thumb { background: #1e3320; border-radius: 2px; }
      `}</style>
    </div>
  );
}