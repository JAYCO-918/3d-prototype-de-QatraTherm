import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Box,
  ChevronLeft,
  ChevronRight,
  Layers,
  Maximize2,
  Minimize2,
  PanelLeft,
  Pause,
  Play,
  X,
} from "lucide-react";
import {
  EQUIP_BY_ID,
  EQUIPMENT,
  PROCESS_LINES,
  TOUR,
  ZONES,
  ZONE_BY_ID,
  sampleScada,
  type ZoneId,
} from "./data";
import type { PlantHandle } from "./plant";

type Panel = "nav" | "inspect" | "scada" | null;

const ZONE_KEYS: Record<string, ZoneId> = {
  "1": "well",
  "2": "pvt",
  "3": "ro",
  "4": "potable",
  "5": "csp",
  "6": "brine",
};

export function Experience() {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const plantRef = useRef<PlantHandle | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [immersive, setImmersive] = useState(false);
  const [tourIndex, setTourIndex] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [pvtOpen, setPvtOpen] = useState(false);
  const [roOpen, setRoOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [clock, setClock] = useState(0);

  const uiRef = useRef({ panel, tourIndex, immersive });
  uiRef.current = { panel, tourIndex, immersive };
  const explodeRef = useRef({ pvt: pvtOpen, ro: roOpen });
  explodeRef.current = { pvt: pvtOpen, ro: roOpen };
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let alive = true;
    let handle: PlantHandle | null = null;
    void (async () => {
      try {
        const { mountPlant } = await import("./plant");
        if (!alive) return;
        handle = mountPlant(canvas, {
          onSelect: (id) => {
            setTourIndex(null);
            if (id) {
              setSelected(id);
              setPanel("inspect");
            } else {
              setSelected(null);
              setPanel((current) => (current === "inspect" ? null : current));
            }
          },
          onHover: (id) => setHover((current) => (current === id ? current : id)),
        });
        plantRef.current = handle;
        handle.setExplode("pvt", explodeRef.current.pvt);
        handle.setExplode("ro", explodeRef.current.ro);
        handle.select(selectedRef.current);
        setReady(true);
      } catch (err) {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "The 3D view could not start.");
      }
    })();
    return () => {
      alive = false;
      handle?.dispose();
      plantRef.current = null;
    };
  }, []);

  useEffect(() => {
    plantRef.current?.select(selected);
  }, [selected]);

  useEffect(() => {
    plantRef.current?.setExplode("pvt", pvtOpen);
  }, [pvtOpen]);

  useEffect(() => {
    plantRef.current?.setExplode("ro", roOpen);
  }, [roOpen]);

  useEffect(() => {
    if (tourIndex == null) return;
    const step = TOUR[tourIndex];
    plantRef.current?.flyTo(step.zone);
    setPvtOpen(step.focus === "pvt");
    setRoOpen(step.focus === "ro");
  }, [tourIndex]);

  useEffect(() => {
    if (tourIndex == null || paused || tourIndex >= TOUR.length - 1) return;
    const id = window.setTimeout(() => setTourIndex((index) => (index == null ? index : index + 1)), 8000);
    return () => window.clearTimeout(id);
  }, [tourIndex, paused]);

  useEffect(() => {
    if (panel !== "scada") return;
    const id = window.setInterval(() => setClock(performance.now() / 1000), 1000);
    return () => window.clearInterval(id);
  }, [panel]);

  useEffect(() => {
    const onChange = () => setImmersive(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (event.key === "Escape") {
        const ui = uiRef.current;
        if (ui.panel) {
          setPanel(null);
          if (ui.panel === "inspect") setSelected(null);
          return;
        }
        if (ui.tourIndex != null) {
          setTourIndex(null);
          return;
        }
        if (ui.immersive || document.fullscreenElement) void exitImmersive();
        return;
      }
      const zone = ZONE_KEYS[event.key];
      if (!zone) return;
      setTourIndex(null);
      plantRef.current?.flyTo(zone);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const equip = selected ? EQUIP_BY_ID[selected] : undefined;
  const hoverEquip = hover ? EQUIP_BY_ID[hover] : undefined;
  const tour = tourIndex == null ? null : TOUR[tourIndex];
  const scada = useMemo(() => sampleScada(clock), [clock]);

  function toggle(next: Panel) {
    setTourIndex(null);
    setPanel((current) => (current === next ? null : next));
  }

  function openEquip(id: string) {
    setTourIndex(null);
    setSelected(id);
    setPanel("inspect");
    plantRef.current?.frame(id);
  }

  function goZone(zone: ZoneId | "overview") {
    setTourIndex(null);
    plantRef.current?.flyTo(zone);
  }

  async function enterImmersive() {
    setImmersive(true);
    const node = rootRef.current;
    if (!node || document.fullscreenElement) return;
    try {
      await node.requestFullscreen();
    } catch {
      /* The preview frame may refuse fullscreen; chrome still hides. */
    }
  }

  async function exitImmersive() {
    setImmersive(false);
    if (!document.fullscreenElement) return;
    try {
      await document.exitFullscreen();
    } catch {
      /* Already left. */
    }
  }

  return (
    <div className="qt" ref={rootRef} data-immersive={immersive ? "true" : "false"}>
      <canvas ref={canvasRef} className="qt-canvas" aria-label="QatraTherm installation" />
      <div className="qt-veil" />
      {error ? <p className="qt-error">{error}</p> : null}

      <header className="qt-top">
        <p className="qt-brand">
          <strong>QatraTherm</strong>
          <span>B.Yaakoub · Tendla, El Meghaïer</span>
        </p>
        <div className="qt-dock" role="toolbar" aria-label="Installation controls">
          <button type="button" aria-pressed={panel === "nav"} onClick={() => toggle("nav")} title="Zones">
            <PanelLeft size={18} aria-hidden />
            <span>Zones</span>
          </button>
          <button type="button" aria-pressed={panel === "scada"} onClick={() => toggle("scada")} title="SCADA">
            <Activity size={18} aria-hidden />
            <span>SCADA</span>
          </button>
          <button
            type="button"
            aria-pressed={tourIndex != null}
            onClick={() => {
              if (tourIndex != null) setTourIndex(null);
              else {
                setPanel(null);
                setPaused(false);
                setTourIndex(0);
              }
            }}
            title="Presentation"
          >
            <Play size={18} aria-hidden />
            <span>Tour</span>
          </button>
          <button type="button" aria-pressed={pvtOpen} onClick={() => setPvtOpen((value) => !value)} title="PV/T cutaway">
            <Layers size={18} aria-hidden />
            <span>PV/T</span>
          </button>
          <button type="button" aria-pressed={roOpen} onClick={() => setRoOpen((value) => !value)} title="RO vessel">
            <Box size={18} aria-hidden />
            <span>RO</span>
          </button>
          <button type="button" onClick={() => void enterImmersive()} title="Immersive view">
            <Maximize2 size={18} aria-hidden />
            <span>Immersive</span>
          </button>
        </div>
        <button type="button" className="qt-exit" onClick={() => void exitImmersive()}>
          <Minimize2 size={18} aria-hidden />
          Exit
        </button>
      </header>

      <aside
        className="qt-panel"
        data-side="left"
        data-open={panel === "nav"}
        inert={panel === "nav" ? undefined : true}
        aria-hidden={panel !== "nav"}
        aria-label="Navigation"
      >
        <div className="qt-panel-head">
          <div>
            <p className="qt-kicker">Navigation</p>
            <h2>Six zones</h2>
          </div>
          <button type="button" className="qt-iconbtn" aria-label="Close navigation" onClick={() => setPanel(null)}>
            <X size={18} />
          </button>
        </div>
        <div className="qt-body">
          <p className="qt-lead">
            The model stays clear until you ask for a zone. Keys 1 to 6 fly there. Escape closes this panel without moving the camera.
          </p>
          <button type="button" className="qt-zone" onClick={() => goZone("overview")}>
            <span className="qt-index">00</span>
            <span>
              <strong>Whole installation</strong>
              <span>Return to the site view.</span>
            </span>
          </button>
          {ZONES.map((zone) => {
            const items = EQUIPMENT.filter((item) => item.zone === zone.id);
            const layers = items.filter((item) => item.name.startsWith("Layer"));
            const rest = items.filter((item) => !item.name.startsWith("Layer"));
            return (
              <div key={zone.id}>
                <button type="button" className="qt-zone" data-accent={zone.accent} onClick={() => goZone(zone.id)}>
                  <span className="qt-index">{zone.index}</span>
                  <span>
                    <strong>{zone.name}</strong>
                    <span>{zone.summary}</span>
                  </span>
                </button>
                {rest.map((item) => (
                  <button key={item.id} type="button" className="qt-equip" onClick={() => openEquip(item.id)}>
                    <i className="qt-swatch" data-accent={item.accent} />
                    <strong>{item.name}</strong>
                  </button>
                ))}
                {layers.length > 0 ? (
                  <details className="qt-details">
                    <summary>PV/T cutaway layers</summary>
                    {layers.map((item) => (
                      <button key={item.id} type="button" className="qt-equip" onClick={() => openEquip(item.id)}>
                        <i className="qt-swatch" data-accent={item.accent} />
                        <strong>{item.name}</strong>
                      </button>
                    ))}
                  </details>
                ) : null}
              </div>
            );
          })}
          <button type="button" className="qt-zone" data-accent="control" onClick={() => goZone("control")}>
            <span className="qt-index">PLC</span>
            <span>
              <strong>Supervision</strong>
              <span>Control cabinet. Not a seventh process zone.</span>
            </span>
          </button>
          <button type="button" className="qt-equip" onClick={() => openEquip("eq-plc")}>
            <i className="qt-swatch" data-accent="control" />
            <strong>Supervision cabinet</strong>
          </button>
          <h3 className="qt-group">Process architecture</h3>
          <ul className="qt-process">
            {PROCESS_LINES.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="qt-note">Conceptual study for Tendla. B.Yaakoub. Flows are the design intent, not a new process.</p>
        </div>
      </aside>

      <aside
        className="qt-panel"
        data-side="right"
        data-open={panel === "inspect" && Boolean(equip)}
        inert={panel === "inspect" && equip ? undefined : true}
        aria-hidden={panel !== "inspect"}
        aria-label="Equipment"
      >
        {equip ? (
          <>
            <div className="qt-panel-head">
              <div>
                <p className="qt-kicker">{ZONE_BY_ID[equip.zone].name}</p>
                <h2>{equip.name}</h2>
              </div>
              <button
                type="button"
                className="qt-iconbtn"
                aria-label="Close equipment"
                onClick={() => {
                  setPanel(null);
                  setSelected(null);
                }}
              >
                <X size={18} />
              </button>
            </div>
            <div className="qt-body">
              <p className="qt-lead">{equip.summary}</p>
              <button type="button" className="qt-textbtn" onClick={() => plantRef.current?.frame(equip.id)}>
                Frame in view
              </button>
              <Section title="Inputs" items={equip.inputs} />
              <Section title="Outputs" items={equip.outputs} />
              <Section title="Sensors" items={equip.sensors} />
              <Section title="Relationships" items={equip.relations} />
              <div className="qt-section">
                <h3>Design basis</h3>
                <dl className="qt-specs">
                  {equip.specs.map((spec) => (
                    <div key={spec.label}>
                      <dt>{spec.label}</dt>
                      <dd>{spec.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <p className="qt-note">Illustrative design basis for the Tendla case. Not as-built nameplate data.</p>
            </div>
          </>
        ) : null}
      </aside>

      <aside
        className="qt-panel"
        data-side="right"
        data-open={panel === "scada"}
        inert={panel === "scada" ? undefined : true}
        aria-hidden={panel !== "scada"}
        aria-label="SCADA"
      >
        <div className="qt-panel-head">
          <div>
            <p className="qt-kicker">Supervision</p>
            <h2>SCADA</h2>
          </div>
          <button type="button" className="qt-iconbtn" aria-label="Close SCADA" onClick={() => setPanel(null)}>
            <X size={18} />
          </button>
        </div>
        <div className="qt-body">
          <p className="qt-banner">
            Illustrative instrumentation. These figures are simulated from the conceptual design basis. They are not live measurements from Tendla.
          </p>
          {scada.map((group) => (
            <section key={group.title}>
              <h3 className="qt-group">{group.title}</h3>
              <div className="qt-metrics">
                {group.metrics.map((metric) => (
                  <div key={metric.label} className="qt-metric" data-accent={metric.accent}>
                    <span>{metric.label}</span>
                    <b>
                      {metric.value} {metric.unit === "sim" ? "" : metric.unit}
                    </b>
                    <span className="qt-sim">SIM</span>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </aside>

      {tour ? (
        <section className="qt-tour" aria-live="polite">
          <p className="qt-kicker">
            {tourIndex! + 1} / {TOUR.length}
          </p>
          <div>
            <h2>{tour.title}</h2>
            <p>{tour.body}</p>
          </div>
          <div className="qt-tour-actions">
            <button
              type="button"
              className="qt-iconbtn"
              aria-label="Previous step"
              onClick={() => setTourIndex((index) => (index == null ? index : Math.max(0, index - 1)))}
            >
              <ChevronLeft size={18} />
            </button>
            <button type="button" className="qt-iconbtn" aria-label={paused ? "Resume tour" : "Pause tour"} onClick={() => setPaused((value) => !value)}>
              {paused ? <Play size={18} /> : <Pause size={18} />}
            </button>
            <button
              type="button"
              className="qt-iconbtn"
              aria-label="Next step"
              onClick={() => setTourIndex((index) => (index == null ? index : Math.min(TOUR.length - 1, index + 1)))}
            >
              <ChevronRight size={18} />
            </button>
            <button type="button" className="qt-iconbtn" aria-label="Close tour" onClick={() => setTourIndex(null)}>
              <X size={18} />
            </button>
          </div>
        </section>
      ) : null}

      {tour == null && hoverEquip ? <div className="qt-hover">{hoverEquip.name}</div> : null}

      <p className="qt-sign">B.Yaakoub</p>
      <div className="qt-legend" aria-hidden="true">
        <span>
          <i data-accent="water" />
          Water
        </span>
        <span>
          <i data-accent="thermal" />
          Heat
        </span>
        <span>
          <i data-accent="brine" />
          Brine
        </span>
        <span>
          <i data-accent="electric" />
          Power
        </span>
        <span>
          <i data-accent="control" />
          Control
        </span>
      </div>
      <span className="sr-only">{ready ? "Model ready" : "Preparing the installation"}</span>
    </div>
  );
}

function Section({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="qt-section">
      <h3>{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
