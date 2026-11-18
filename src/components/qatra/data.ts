export type ZoneId = "well" | "pvt" | "ro" | "potable" | "csp" | "brine" | "control";

export type Accent = "water" | "thermal" | "brine" | "control" | "electric";

export type Zone = {
  id: ZoneId;
  index: string;
  name: string;
  summary: string;
  accent: Accent;
};

export type Spec = { label: string; value: string };

export type Equip = {
  id: string;
  zone: ZoneId;
  name: string;
  accent: Accent;
  summary: string;
  inputs: string[];
  outputs: string[];
  sensors: string[];
  relations: string[];
  specs: Spec[];
};

export const ZONES: Zone[] = [
  {
    id: "well",
    index: "01",
    name: "Groundwater & pretreatment",
    summary: "Wellhead, filtration and raw-water buffer before desalination.",
    accent: "water",
  },
  {
    id: "pvt",
    index: "02",
    name: "PV/T field & thermal buffer",
    summary: "Hybrid collectors, eight-layer cutaway, inverter and heat storage.",
    accent: "thermal",
  },
  {
    id: "ro",
    index: "03",
    name: "Reverse osmosis",
    summary: "High-pressure skid and an exploded membrane vessel.",
    accent: "water",
  },
  {
    id: "potable",
    index: "04",
    name: "Potable branch",
    summary: "Remineralisation, disinfection and finished-water storage.",
    accent: "water",
  },
  {
    id: "csp",
    index: "05",
    name: "CSP & power block",
    summary: "Trough collectors, steam generator and micro-turbine.",
    accent: "thermal",
  },
  {
    id: "brine",
    index: "06",
    name: "Brine evaporation",
    summary: "Lined solar basins and a crystallisation cell. Separate from potable water.",
    accent: "brine",
  },
];

export const PROCESS_LINES = [
  "Aquifer → well → multimedia filter → cartridge → raw buffer",
  "Raw buffer → PV/T feed preheater → high-pressure pump → RO",
  "Permeate → remineralisation → UV → chlorine → potable tank",
  "Concentrate → lined evaporation basins → crystallisation",
  "PV/T electricity → inverter → switchgear",
  "PV/T heat → thermal buffer → feed preheater → return",
  "CSP troughs → steam generator → micro-turbine → condenser",
  "Switchgear supplies pumps, dosing and supervision",
];

export const EQUIPMENT: Equip[] = [
  {
    id: "eq-well",
    zone: "well",
    name: "Wellhead & submersible pump",
    accent: "water",
    summary:
      "Lifts brackish groundwater from the Tendla aquifer to the pretreatment pad. The submersible set sits in the borehole; the surface head carries the master valve and sample point.",
    inputs: ["Aquifer groundwater"],
    outputs: ["Raw water to the multimedia filter"],
    sensors: ["Borehole level", "Discharge pressure", "Conductivity", "Temperature"],
    relations: ["Feeds the multimedia filter", "Supervised by the PLC cabinet"],
    specs: [
      { label: "Role", value: "Raw-water lift" },
      { label: "Design flow", value: "12 m³/h conceptual" },
      { label: "Source", value: "Brackish groundwater" },
      { label: "Indicative TDS", value: "4.5 g/L" },
    ],
  },
  {
    id: "eq-filter",
    zone: "well",
    name: "Multimedia filter",
    accent: "water",
    summary:
      "Vertical pressure filter that removes sand and suspended solids before the cartridge stage, protecting the RO membranes from particulate fouling.",
    inputs: ["Raw well water"],
    outputs: ["Clarified water to the cartridge filter"],
    sensors: ["Inlet pressure", "Outlet pressure", "Differential pressure"],
    relations: ["Downstream of the wellhead", "Upstream of the 5 µm cartridge"],
    specs: [
      { label: "Duty", value: "Suspended-solids removal" },
      { label: "Vessel", value: "Vertical pressure filter" },
      { label: "Backwash", value: "Intermittent, to waste" },
    ],
  },
  {
    id: "eq-cartridge",
    zone: "well",
    name: "Cartridge filter",
    accent: "water",
    summary: "Polishing filtration ahead of the raw-water buffer. Last solids barrier before the high-pressure pump and membranes.",
    inputs: ["Filter effluent"],
    outputs: ["Polished raw water"],
    sensors: ["Differential pressure"],
    relations: ["Protects the RO high-pressure pump and membranes"],
    specs: [
      { label: "Rating", value: "5 µm conceptual" },
      { label: "Duty", value: "Guard filtration" },
    ],
  },
  {
    id: "eq-dose",
    zone: "well",
    name: "Antiscalant dosing",
    accent: "control",
    summary:
      "Metering skid that doses antiscalant into the RO feed so sparingly soluble salts do not scale the membranes at the design recovery.",
    inputs: ["Antiscalant concentrate", "Dose signal from the PLC"],
    outputs: ["Dosed chemical into the RO feed line"],
    sensors: ["Tank level", "Stroke rate", "Flow switch"],
    relations: ["Interlocked with RO feed flow", "Does not enter the potable branch directly"],
    specs: [
      { label: "Duty", value: "Scaling control" },
      { label: "Actuation", value: "Metering pump" },
    ],
  },
  {
    id: "eq-raw",
    zone: "well",
    name: "Raw-water buffer",
    accent: "water",
    summary:
      "Decouples the well pump from the RO skid so pretreatment flow and desalination flow can differ for a short period without tripping either set.",
    inputs: ["Pretreated groundwater"],
    outputs: ["RO feed via the PV/T preheater"],
    sensors: ["Level", "Temperature"],
    relations: ["Suction side of the feed path to the preheater and high-pressure pump"],
    specs: [
      { label: "Service", value: "Raw water" },
      { label: "Function", value: "Hydraulic buffer" },
    ],
  },
  {
    id: "eq-pvfield",
    zone: "pvt",
    name: "PV/T collector field",
    accent: "thermal",
    summary:
      "Twelve hybrid photovoltaic-thermal collectors tilted toward south. Cells generate electricity; the absorber behind them heats a closed liquid loop.",
    inputs: ["Solar irradiance", "Cool return fluid from the preheater"],
    outputs: ["DC electricity to the inverter", "Warm fluid to the thermal buffer"],
    sensors: ["String current", "Fluid outlet temperature", "Irradiance (field)"],
    relations: ["Electrical output joins the switchgear through the inverter", "Thermal output charges the buffer tank"],
    specs: [
      { label: "Collectors", value: "12 hybrid modules" },
      { label: "Orientation", value: "South-facing tilt" },
      { label: "Electric duty", value: "About 6 kWp conceptual" },
    ],
  },
  {
    id: "eq-glass",
    zone: "pvt",
    name: "Layer 1 — low-iron glass",
    accent: "water",
    summary: "Front cover of the PV/T laminate. Transmits the solar spectrum to the cells and shields the stack from the desert environment.",
    inputs: ["Incident sunlight"],
    outputs: ["Transmitted irradiance to the cell string"],
    sensors: ["Module temperature (shared)"],
    relations: ["Outer face of the eight-layer coupon"],
    specs: [
      { label: "Position", value: "Sun side" },
      { label: "Function", value: "Optical cover and weather barrier" },
    ],
  },
  {
    id: "eq-eva1",
    zone: "pvt",
    name: "Layer 2 — EVA encapsulant",
    accent: "electric",
    summary: "Front encapsulant. Optically clear polymer that bonds the glass to the cells and keeps moisture out of the string.",
    inputs: ["Light from the glass"],
    outputs: ["Light to the cells"],
    sensors: ["None dedicated"],
    relations: ["Paired with the rear EVA sheet"],
    specs: [
      { label: "Material", value: "EVA" },
      { label: "Role", value: "Adhesion and optical coupling" },
    ],
  },
  {
    id: "eq-cells",
    zone: "pvt",
    name: "Layer 3 — photovoltaic cells",
    accent: "electric",
    summary: "Crystalline cell matrix. Converts part of the transmitted spectrum to direct current. Waste heat is conducted toward the absorber rather than rejected only to the air.",
    inputs: ["Transmitted sunlight"],
    outputs: ["DC current to the inverter", "Conducted heat to the absorber"],
    sensors: ["String voltage", "String current"],
    relations: ["Electrically upstream of the inverter", "Thermally upstream of the absorber plate"],
    specs: [
      { label: "Output", value: "Direct current" },
      { label: "Coupling", value: "Laminated between EVA sheets" },
    ],
  },
  {
    id: "eq-eva2",
    zone: "pvt",
    name: "Layer 4 — rear EVA",
    accent: "electric",
    summary: "Rear encapsulant between the cells and the backsheet. Completes the electrical laminate before the thermal stack begins.",
    inputs: ["Cell rear face"],
    outputs: ["Bonded interface to the backsheet"],
    sensors: ["None dedicated"],
    relations: ["Part of the PV laminate, not the fluid loop"],
    specs: [
      { label: "Material", value: "EVA" },
      { label: "Role", value: "Rear encapsulation" },
    ],
  },
  {
    id: "eq-back",
    zone: "pvt",
    name: "Layer 5 — backsheet",
    accent: "electric",
    summary: "Dielectric rear sheet of the PV laminate. Electrically isolates the cells from the metallic thermal absorber.",
    inputs: ["Laminated cell stack"],
    outputs: ["Insulated interface to the absorber"],
    sensors: ["Insulation monitoring at the inverter"],
    relations: ["Separates the electrical laminate from the thermal circuit"],
    specs: [
      { label: "Role", value: "Dielectric barrier" },
      { label: "Constraint", value: "Must not become a fluid boundary" },
    ],
  },
  {
    id: "eq-absorber",
    zone: "pvt",
    name: "Layer 6 — thermal absorber",
    accent: "thermal",
    summary: "Metal plate that collects heat from the laminate and delivers it into the fluid channels. This is the handoff from the PV stack to the thermal loop.",
    inputs: ["Conducted heat from the laminate"],
    outputs: ["Heat into the fluid channels"],
    sensors: ["Absorber temperature"],
    relations: ["Between the backsheet and the fluid channels"],
    specs: [
      { label: "Material", value: "Metal absorber plate" },
      { label: "Circuit", value: "Closed thermal loop" },
    ],
  },
  {
    id: "eq-channels",
    zone: "pvt",
    name: "Layer 7 — fluid channels",
    accent: "thermal",
    summary: "Parallel channels carrying the heat-transfer liquid. Warm fluid leaves toward the thermal buffer; cooled fluid returns from the RO feed preheater.",
    inputs: ["Cool return from the preheater"],
    outputs: ["Warm supply to the thermal buffer"],
    sensors: ["Supply temperature", "Return temperature", "Loop flow"],
    relations: ["Charges the thermal buffer", "Does not mix with process water"],
    specs: [
      { label: "Service", value: "Closed HTF loop" },
      { label: "Coupling", value: "Heat only, via the preheater" },
    ],
  },
  {
    id: "eq-insul",
    zone: "pvt",
    name: "Layer 8 — insulation & frame",
    accent: "thermal",
    summary: "Rear insulation and the aluminium frame. Limits back losses so low-grade heat stays in the liquid loop instead of the wind.",
    inputs: ["Rear face of the channel plate"],
    outputs: ["Reduced thermal loss"],
    sensors: ["None dedicated"],
    relations: ["Closes the PV/T stack"],
    specs: [
      { label: "Role", value: "Loss control and structure" },
      { label: "Face", value: "Rear, away from the sun" },
    ],
  },
  {
    id: "eq-inverter",
    zone: "pvt",
    name: "PV inverter",
    accent: "electric",
    summary: "Converts the collector-field direct current to alternating current and synchronises it with the site switchgear.",
    inputs: ["DC from the PV cell strings"],
    outputs: ["AC to the switchgear"],
    sensors: ["DC voltage", "AC power", "Cabinet temperature", "Insulation"],
    relations: ["Electrically upstream of the switchgear", "Independent of the brine and potable lines"],
    specs: [
      { label: "Conversion", value: "DC to AC" },
      { label: "Field", value: "PV/T collectors" },
    ],
  },
  {
    id: "eq-tbuffer",
    zone: "pvt",
    name: "Thermal buffer",
    accent: "thermal",
    summary:
      "Insulated tank on the closed PV/T loop. Stores low-grade heat so the RO feed preheater can run when irradiance dips for a few minutes.",
    inputs: ["Warm fluid from the PV/T channels"],
    outputs: ["Heat to the RO feed preheater"],
    sensors: ["Top temperature", "Bottom temperature", "Level"],
    relations: ["Between the collector field and the feed preheater", "Not a process-water vessel"],
    specs: [
      { label: "Service", value: "Closed thermal loop" },
      { label: "Indicative range", value: "45–65 °C" },
      { label: "Volume", value: "2 m³ conceptual" },
    ],
  },
  {
    id: "eq-hex",
    zone: "pvt",
    name: "RO feed preheater",
    accent: "thermal",
    summary:
      "Liquid-to-liquid exchanger. PV/T loop heat warms the RO feed. The two fluids do not mix. This is the thermal coupling between the hybrid collectors and desalination.",
    inputs: ["Raw water from the buffer", "Warm HTF from the thermal buffer"],
    outputs: ["Preheated RO feed", "Cool HTF return to the field"],
    sensors: ["Feed inlet temperature", "Feed outlet temperature", "HTF inlet temperature", "HTF outlet temperature"],
    relations: ["Only intended heat link from PV/T into the water train"],
    specs: [
      { label: "Duty", value: "Feed preheat" },
      { label: "Barrier", value: "No fluid mixing" },
    ],
  },
  {
    id: "eq-hpp",
    zone: "ro",
    name: "High-pressure pump",
    accent: "water",
    summary: "Raises pretreated, preheated feed to membrane pressure. Fed electrically from the site switchgear.",
    inputs: ["Preheated feed", "Electrical supply"],
    outputs: ["Pressurised feed to the RO vessels"],
    sensors: ["Suction pressure", "Discharge pressure", "Motor current", "Bearing temperature"],
    relations: ["Between the preheater and the RO skid", "Load on the switchgear"],
    specs: [
      { label: "Service", value: "RO feed" },
      { label: "Indicative pressure", value: "14 bar" },
    ],
  },
  {
    id: "eq-roskid",
    zone: "ro",
    name: "RO membrane skid",
    accent: "water",
    summary:
      "Four pressure vessels on a steel frame. Feed enters after the high-pressure pump. Permeate and concentrate leave on separate headers and must not be recombined.",
    inputs: ["Pressurised feed"],
    outputs: ["Permeate to the potable branch", "Concentrate to the brine basins"],
    sensors: ["Feed pressure", "Concentrate pressure", "Permeate flow", "Concentrate flow", "Permeate conductivity"],
    relations: ["Splits the water train into potable and brine paths"],
    specs: [
      { label: "Vessels", value: "4 installed" },
      { label: "Indicative recovery", value: "65%" },
      { label: "Feed TDS", value: "4.5 g/L conceptual" },
    ],
  },
  {
    id: "eq-rovessel",
    zone: "ro",
    name: "RO vessel — technical view",
    accent: "water",
    summary:
      "Didactic pressure vessel beside the skid: FRP shell, two end caps, three spiral-wound elements and a central permeate tube. The exploded view slides the caps and elements along the axis.",
    inputs: ["Feed at one end cap"],
    outputs: ["Permeate from the centre tube", "Concentrate from the opposite cap"],
    sensors: ["Represented on the skid headers"],
    relations: ["Same internal architecture as the vessels on the skid"],
    specs: [
      { label: "Elements", value: "3 in series" },
      { label: "Shell", value: "FRP pressure vessel" },
      { label: "View", value: "Maintenance explode along axis" },
    ],
  },
  {
    id: "eq-remin",
    zone: "potable",
    name: "Remineralisation filter",
    accent: "water",
    summary: "Calcite contactor on the permeate line. Restores a little alkalinity and hardness so the finished water is less aggressive.",
    inputs: ["RO permeate"],
    outputs: ["Remineralised permeate to UV"],
    sensors: ["Differential pressure", "Outlet pH"],
    relations: ["First unit of the potable branch", "Never receives concentrate"],
    specs: [
      { label: "Media", value: "Calcite conceptual" },
      { label: "Service", value: "Permeate only" },
    ],
  },
  {
    id: "eq-uv",
    zone: "potable",
    name: "UV reactor",
    accent: "water",
    summary: "Closed ultraviolet reactor for disinfection of remineralised permeate, upstream of residual chlorination.",
    inputs: ["Remineralised permeate", "Electrical supply"],
    outputs: ["Disinfected water"],
    sensors: ["UV intensity", "Lamp status"],
    relations: ["Between remineralisation and chlorination"],
    specs: [
      { label: "Duty", value: "Primary disinfection" },
      { label: "Service", value: "Potable branch" },
    ],
  },
  {
    id: "eq-chlor",
    zone: "potable",
    name: "Chlorine dosing",
    accent: "control",
    summary: "Small metering set that leaves a residual disinfectant in the water sent to the potable tank.",
    inputs: ["Disinfected permeate", "Hypochlorite"],
    outputs: ["Chlorinated finished water"],
    sensors: ["Residual chlorine", "Tank level", "Dose rate"],
    relations: ["Last chemical step before storage"],
    specs: [
      { label: "Target residual", value: "0.4 mg/L illustrative" },
      { label: "Duty", value: "Residual protection" },
    ],
  },
  {
    id: "eq-ptank",
    zone: "potable",
    name: "Potable storage tank",
    accent: "water",
    summary: "Finished-water reservoir. Isolated from the raw buffer and from the brine basins. Distribution is taken from this tank only.",
    inputs: ["Chlorinated finished water"],
    outputs: ["Water to distribution"],
    sensors: ["Level", "Residual chlorine", "Temperature"],
    relations: ["End of the potable branch"],
    specs: [
      { label: "Service", value: "Potable water" },
      { label: "Volume", value: "20 m³ conceptual" },
    ],
  },
  {
    id: "eq-troughs",
    zone: "csp",
    name: "CSP trough field",
    accent: "thermal",
    summary:
      "Three rows of parabolic troughs on a north–south axis. Mirrors concentrate direct sun onto receiver tubes. This field is separate from the PV/T collectors.",
    inputs: ["Direct normal irradiance"],
    outputs: ["Heated receiver fluid toward the steam generator"],
    sensors: ["DNI", "Receiver outlet temperature", "Loop flow"],
    relations: ["Heat source for the steam generator", "No hydraulic link to the RO feed"],
    specs: [
      { label: "Collector", value: "Parabolic trough" },
      { label: "Rows", value: "3" },
      { label: "Axis", value: "North–south" },
    ],
  },
  {
    id: "eq-steam",
    zone: "csp",
    name: "Steam generator",
    accent: "thermal",
    summary: "Raises steam from the trough-field heat. Steam leaves to the micro-turbine; condensate returns from the condenser.",
    inputs: ["Heat from the CSP receivers", "Condensate return"],
    outputs: ["Steam to the micro-turbine"],
    sensors: ["Steam pressure", "Steam temperature", "Drum level"],
    relations: ["Between the trough field and the turbine", "Closed power-cycle loop"],
    specs: [
      { label: "Cycle", value: "Small steam Rankine" },
      { label: "Indicative pressure", value: "8 bar" },
    ],
  },
  {
    id: "eq-turbine",
    zone: "csp",
    name: "Micro-turbine & generator",
    accent: "thermal",
    summary: "Steam expands through the micro-turbine. The coupled generator exports alternating current to the same switchgear as the PV inverter.",
    inputs: ["Steam from the generator vessel", "No process water"],
    outputs: ["Exhaust steam to the condenser", "AC power to the switchgear"],
    sensors: ["Speed", "Power", "Inlet steam pressure", "Bearing temperature"],
    relations: ["Driven only by the CSP steam cycle", "Electrically paralleled at the switchgear"],
    specs: [
      { label: "Indicative output", value: "22 kW conceptual" },
      { label: "Driver", value: "CSP steam" },
    ],
  },
  {
    id: "eq-condenser",
    zone: "csp",
    name: "Condenser",
    accent: "thermal",
    summary: "Condenses turbine exhaust so water can return to the steam generator. This loop is not the desalination train.",
    inputs: ["Turbine exhaust"],
    outputs: ["Condensate to the steam generator"],
    sensors: ["Vacuum or back-pressure", "Condensate temperature"],
    relations: ["Closes the Rankine loop"],
    specs: [
      { label: "Duty", value: "Exhaust condensation" },
      { label: "Loop", value: "Power cycle only" },
    ],
  },
  {
    id: "eq-switch",
    zone: "csp",
    name: "Site switchgear",
    accent: "electric",
    summary:
      "Common AC bus for the PV inverter and the turbine generator. Feeds the well pump, high-pressure pump, dosing, UV and the PLC.",
    inputs: ["AC from the PV inverter", "AC from the turbine generator"],
    outputs: ["Site loads"],
    sensors: ["Bus voltage", "Feeder currents", "Breaker status"],
    relations: ["Electrical node of the plant", "No process-fluid connection"],
    specs: [
      { label: "Sources", value: "PV/T and micro-turbine" },
      { label: "Loads", value: "Pumps, UV, dosing, controls" },
    ],
  },
  {
    id: "eq-basins",
    zone: "brine",
    name: "Lined evaporation basins",
    accent: "brine",
    summary:
      "Three lined solar basins taking RO concentrate only. The liner isolates brine from the soil and from the potable tank. Evaporation is the disposal path in this concept.",
    inputs: ["RO concentrate"],
    outputs: ["Water vapour to atmosphere", "Stronger brine toward crystallisation"],
    sensors: ["Level", "Brine conductivity"],
    relations: ["Downstream of the RO concentrate header only"],
    specs: [
      { label: "Basins", value: "3 lined cells" },
      { label: "Liner", value: "Impermeable liner on a prepared bed" },
      { label: "Service", value: "Concentrate, not permeate" },
    ],
  },
  {
    id: "eq-crystal",
    zone: "brine",
    name: "Crystallisation basin",
    accent: "brine",
    summary:
      "Downstream cell where evaporation can continue toward solid salt. Kept in the brine zone so crystals never enter storage or distribution.",
    inputs: ["Concentrated brine from the evaporation basins"],
    outputs: ["Further vapour", "Moist salt"],
    sensors: ["Level", "Visual crust observation"],
    relations: ["Last unit on the concentrate path"],
    specs: [
      { label: "Duty", value: "Terminal evaporation" },
      { label: "Product", value: "Salt crust, not drinking water" },
    ],
  },
  {
    id: "eq-plc",
    zone: "control",
    name: "Supervision cabinet",
    accent: "control",
    summary:
      "PLC and local interface supervising wells, RO, dosing, PV/T temperatures and the power block. The SCADA figures in this study are illustrative, not a live link to Tendla.",
    inputs: ["Instrument signals", "Electrical supply from the switchgear"],
    outputs: ["Pump and dose commands", "Alarms"],
    sensors: ["Cabinet temperature", "Communications status", "Watchdog"],
    relations: ["Observes every zone", "Does not carry process water, steam or brine"],
    specs: [
      { label: "Role", value: "Process supervision" },
      { label: "Data in this view", value: "Simulated" },
    ],
  },
];

export const EQUIP_BY_ID: Record<string, Equip> = Object.fromEntries(EQUIPMENT.map((item) => [item.id, item]));

export const ZONE_BY_ID: Record<ZoneId, Zone> = Object.fromEntries(
  [
    ...ZONES,
    {
      id: "control" as const,
      index: "00",
      name: "Supervision",
      summary: "PLC cabinet and illustrative instrumentation.",
      accent: "control" as const,
    },
  ].map((zone) => [zone.id, zone]),
) as Record<ZoneId, Zone>;

export type TourStep = {
  zone: ZoneId | "overview";
  title: string;
  body: string;
  focus: "pvt" | "ro" | null;
};

export const TOUR: TourStep[] = [
  {
    zone: "overview",
    title: "QatraTherm at Tendla",
    body: "A conceptual plant for El Meghaïer: brackish groundwater, hybrid PV/T collectors, reverse osmosis, a small CSP steam cycle, and brine kept in lined basins.",
    focus: null,
  },
  {
    zone: "well",
    title: "Lift and pretreatment",
    body: "The well lifts groundwater. Multimedia and cartridge filters, then a raw buffer, prepare the feed. Antiscalant is metered for the membranes.",
    focus: null,
  },
  {
    zone: "pvt",
    title: "Electricity and low-grade heat",
    body: "The field produces current and warm fluid. The coupon separates the eight PV/T layers. Heat stops in a buffer, then preheats RO feed without mixing the two liquids.",
    focus: "pvt",
  },
  {
    zone: "ro",
    title: "Desalination skid",
    body: "The high-pressure pump feeds the vessels. Permeate turns toward the potable branch. Concentrate turns south, toward the basins. The stand shows the vessel internals.",
    focus: "ro",
  },
  {
    zone: "potable",
    title: "Finished water",
    body: "Permeate is remineralised, passed through UV, chlorinated and stored. This tank is the only source for distribution.",
    focus: null,
  },
  {
    zone: "csp",
    title: "Steam and the micro-turbine",
    body: "Troughs are a second solar system, for direct sun and steam. The turbine generator and the PV inverter meet only at the switchgear.",
    focus: null,
  },
  {
    zone: "brine",
    title: "Brine, kept separate",
    body: "Concentrate evaporates in lined basins. A last cell can take the brine on toward salt. Nothing here returns to the potable tank.",
    focus: null,
  },
  {
    zone: "control",
    title: "Supervision",
    body: "The cabinet is the control layer. Open SCADA for the instrument set. Every figure there is simulated for the study, not a field reading.",
    focus: null,
  },
];

export type ScadaMetric = {
  label: string;
  value: string;
  unit: string;
  accent: Accent;
};

export type ScadaGroup = {
  title: string;
  accent: Accent;
  metrics: ScadaMetric[];
};

function wave(t: number, amp: number, speed: number, phase: number) {
  return Math.sin(t * speed + phase) * amp;
}

function num(value: number, digits: number) {
  return value.toFixed(digits);
}

/** Illustrative traces. Not live plant data. */
export function sampleScada(t: number): ScadaGroup[] {
  const flow = 11.6 + wave(t, 0.25, 0.35, 0.4);
  const recovery = 0.65 + wave(t, 0.008, 0.2, 1.2);
  const permeate = flow * recovery;
  const brine = flow - permeate;
  const pv = Math.max(0.4, 4.8 + wave(t, 0.6, 0.25, 0.2));
  const dni = Math.max(120, 780 + wave(t, 40, 0.15, 0.8));
  const turb = Math.max(6, 22 + wave(t, 1.4, 0.3, 1.7));

  return [
    {
      title: "Groundwater",
      accent: "water",
      metrics: [
        { label: "Borehole level", value: num(64 + wave(t, 1.2, 0.2, 0), 0), unit: "%", accent: "water" },
        { label: "Raw flow", value: num(flow, 1), unit: "m³/h", accent: "water" },
        { label: "Conductivity", value: num(7.1 + wave(t, 0.08, 0.4, 1), 2), unit: "mS/cm", accent: "water" },
        { label: "Filter ΔP", value: num(0.42 + wave(t, 0.03, 0.5, 2), 2), unit: "bar", accent: "water" },
      ],
    },
    {
      title: "PV/T",
      accent: "thermal",
      metrics: [
        { label: "AC power", value: num(pv, 1), unit: "kW", accent: "electric" },
        { label: "Fluid outlet", value: num(58 + wave(t, 1.5, 0.22, 0.5), 1), unit: "°C", accent: "thermal" },
        { label: "Buffer temp.", value: num(54 + wave(t, 0.8, 0.18, 1.1), 1), unit: "°C", accent: "thermal" },
        { label: "Buffer level", value: num(71 + wave(t, 1, 0.16, 0.3), 0), unit: "%", accent: "thermal" },
      ],
    },
    {
      title: "Reverse osmosis",
      accent: "water",
      metrics: [
        { label: "Feed pressure", value: num(14.2 + wave(t, 0.2, 0.45, 0.6), 1), unit: "bar", accent: "water" },
        { label: "Recovery", value: num(recovery * 100, 1), unit: "%", accent: "water" },
        { label: "Permeate cond.", value: num(280 + wave(t, 12, 0.33, 1.4), 0), unit: "µS/cm", accent: "water" },
        { label: "Concentrate", value: num(brine, 1), unit: "m³/h", accent: "brine" },
      ],
    },
    {
      title: "Potable",
      accent: "water",
      metrics: [
        { label: "Permeate flow", value: num(permeate, 1), unit: "m³/h", accent: "water" },
        { label: "Tank level", value: num(68 + wave(t, 1.5, 0.12, 0.9), 0), unit: "%", accent: "water" },
        { label: "Free chlorine", value: num(0.4 + wave(t, 0.03, 0.4, 2.1), 2), unit: "mg/L", accent: "water" },
        { label: "UV intensity", value: num(92 + wave(t, 2, 0.5, 0.2), 0), unit: "%", accent: "water" },
      ],
    },
    {
      title: "CSP & turbine",
      accent: "thermal",
      metrics: [
        { label: "DNI", value: num(dni, 0), unit: "W/m²", accent: "thermal" },
        { label: "Steam pressure", value: num(8.1 + wave(t, 0.15, 0.28, 0.7), 1), unit: "bar", accent: "thermal" },
        { label: "Generator", value: num(turb, 1), unit: "kW", accent: "electric" },
        { label: "Bus voltage", value: num(400 + wave(t, 2, 0.6, 0.1), 0), unit: "V", accent: "electric" },
      ],
    },
    {
      title: "Brine & control",
      accent: "brine",
      metrics: [
        { label: "Basin evap.", value: num(0.18 + wave(t, 0.02, 0.2, 1), 2), unit: "m³/h", accent: "brine" },
        { label: "Brine TDS", value: num(13 + wave(t, 0.2, 0.15, 0.4), 1), unit: "g/L", accent: "brine" },
        { label: "PLC watchdog", value: "OK", unit: "sim", accent: "control" },
        { label: "Comms", value: "Local", unit: "sim", accent: "control" },
      ],
    },
  ];
}
