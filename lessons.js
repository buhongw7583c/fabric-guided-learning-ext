/**
 * Declarative Lesson Definitions for Microsoft Fabric Guided Learning
 *
 * Includes:
 * 1. Quick Start: Create a Lakehouse & Explore Sample Data (5 steps)
 * 2. MS Learn Lab 23 — Part 1: Healthcare Lakehouse & CSV Table Ingestion (LamnaHealthcareLH)
 * 3. MS Learn Lab 23 — Part 2: Real-Time Eventhouse & KQL Ingestion (LamnaHealthcareEH)
 * 4. MS Learn Lab 23 — Part 3: Build Fabric IQ Ontology, Entities, Relationships & Data Bindings
 */
window.FABRIC_GUIDED_LESSONS = [
  {
    id: "lakehouse-101",
    title: "1. Quick Start: Lakehouse & Sample Data",
    subtitle: "5-step interactive walkthrough in Microsoft Fabric",
    estimatedMinutes: 3,
    steps: [
      {
        id: "step-1-workspaces",
        title: "Open your Workspace",
        explain: "Workspaces are collaborative places where you create collections of items such as lakehouses, warehouses, and ontologies.",
        instruction: "Select 'Workspaces' in the left navigation rail (or click your workspace name like 'hongtest').",
        narration: "Let's start by opening a Fabric workspace where we'll create our Lakehouse.",
        target: {
          selectors: [
            "[data-testid='nav-workspaces']",
            "button[aria-label*='Workspaces']",
            "a[aria-label*='Workspaces']",
            "[data-automation-id*='workspace']"
          ],
          roleAndText: [
            { role: "button", text: "Workspaces" },
            { role: "menuitem", text: "Workspaces" },
            { role: "link", text: "hongtest" },
            { role: "link", text: "My workspace" }
          ]
        },
        advanceWhenVisible: "[data-testid='new-item-drawer'].open",
        hint: "Look at the far-left navigation bar in Fabric, or click your workspace under 'Recent workspaces'. If you are already inside a workspace, click 'Next →'."
      },
      {
        id: "step-2-new-item",
        title: "Open the '+ New item' menu",
        explain: "Every Fabric artifact—whether Data Engineering, Real-Time Intelligence, or Fabric IQ Ontology—starts from the workspace creation menu.",
        instruction: "Click the '+ New item' button in the top workspace toolbar.",
        narration: "Now click New item in the top action bar to browse the artifacts you can create.",
        target: {
          selectors: [
            "[data-testid='new-item-button']",
            "button[aria-label='New item']",
            "button[aria-label*='New item']",
            "button[data-automation-id='new-item-btn']",
            "[data-testid='workspace-new-item-button']"
          ],
          roleAndText: [
            { role: "button", text: "New item" },
            { role: "menuitem", text: "New item" }
          ]
        },
        advanceWhenVisible: "[data-testid='new-item-drawer'].open, [data-testid='item-card-lakehouse']",
        hint: "Make sure you are inside an active workspace (such as 'hongtest') where the '+ New item' toolbar button is visible."
      },
      {
        id: "step-3-select-lakehouse",
        title: "Select 'Lakehouse'",
        explain: "A Lakehouse combines the scale of OneLake Delta tables & files with the SQL querying power of a data warehouse.",
        instruction: "In the New item panel under 'Store data', click the 'Lakehouse' card.",
        narration: "Under Store data, choose Lakehouse.",
        target: {
          selectors: [
            "[data-testid='item-card-lakehouse']",
            "[data-automation-id='new-item-lakehouse']",
            "[data-testid*='lakehouse' i]",
            "button[aria-label*='Lakehouse' i]",
            "[role='button'][aria-label*='Lakehouse' i]"
          ],
          roleAndText: [
            { role: "button", text: "Lakehouse" },
            { role: "gridcell", text: "Lakehouse" },
            { role: "listitem", text: "Lakehouse" }
          ]
        },
        advanceWhenVisible: "[data-testid='create-lakehouse-modal'].open, [data-testid='create-lakehouse-submit']",
        hint: "You can also type 'Lakehouse' into the search box at the top of the New item panel."
      },
      {
        id: "step-4-name-and-create",
        title: "Name & Create your Lakehouse",
        explain: "Fabric will provision your OneLake storage folders (Tables and Files) and automatically generate a SQL analytics endpoint.",
        instruction: "Enter a name (or copy below) and click 'Create'.",
        narration: "Give your Lakehouse a name and click Create.",
        copyChips: ["SalesLakehouse_Demo"],
        target: {
          selectors: [
            "[data-testid='create-lakehouse-submit']",
            "[data-testid='create-lakehouse-modal'] button.primary",
            "[role='dialog'] button[type='submit']",
            "[role='dialog'] button[data-testid*='create' i]"
          ],
          roleAndText: [
            { role: "button", text: "Create" }
          ]
        },
        advanceWhenVisible: "[data-testid='sample-data-card'], [data-automation-id='start-with-sample-data']",
        hint: "If you see a capacity error, ensure your workspace is assigned to an active Fabric Trial or F-SKU capacity."
      },
      {
        id: "step-5-sample-data",
        title: "Start with Sample Data",
        explain: "Once your Lakehouse opens in the Lakehouse Explorer, you can populate it with curated sample datasets in one click.",
        instruction: "Click 'Start with sample data' in the Lakehouse Explorer canvas.",
        narration: "Finally, select Start with sample data in the Lakehouse Explorer to load Delta tables.",
        target: {
          selectors: [
            "[data-testid='sample-data-card']",
            "[data-automation-id='start-with-sample-data']",
            "[data-testid*='sample-data' i]",
            "button[aria-label*='sample data' i]"
          ],
          roleAndText: [
            { role: "button", text: "Start with sample data" },
            { role: "button", text: "Sample data" }
          ]
        },
        advanceWhenVisible: "[data-testid='lakehouse-loaded-banner']",
        hint: "Look for the 'Start with sample data' tile in the center of the Lakehouse Explorer."
      }
    ]
  },

  // ===========================================================================
  // MS LEARN LAB 23 — PART 1: LAKEHOUSE & CSV TO TABLES (LamnaHealthcareLH)
  // ===========================================================================
  {
    id: "lab23-part1-lakehouse",
    title: "2. [Lab 23 Part 1] Healthcare Lakehouse & CSVs",
    subtitle: "Create LamnaHealthcareLH, upload 5 healthcare CSVs & convert to Delta tables",
    estimatedMinutes: 10,
    steps: [
      {
        id: "lab23-p1-s1-workspace",
        title: "Open your Target Fabric Workspace",
        explain: "Behind the scenes: Fabric IQ Ontology unifies static Lakehouse Delta tables with streaming Eventhouse KQL tables inside a single Fabric Workspace.",
        instruction: "Open your Fabric Workspace (e.g., 'hongtest') or click 'Workspaces' on the left rail.",
        narration: "Welcome to Lab 23: Create an Ontology with Fabric IQ. First, open your target Fabric workspace.",
        downloadLinks: [
          {
            label: "📥 Download Lab 23 sample-data.zip",
            url: "https://github.com/MicrosoftLearning/mslearn-fabric/raw/main/Allfiles/Labs/23-24/sample-data.zip"
          }
        ],
        target: {
          selectors: [
            "[data-testid='nav-workspaces']",
            "button[aria-label*='Workspaces']"
          ],
          roleAndText: [
            { role: "link", text: "hongtest" },
            { role: "button", text: "Workspaces" }
          ]
        },
        hint: "Download and unzip sample-data.zip using the button above! You'll need the 6 CSV files (Hospitals, Departments, Rooms, Patients, VitalSignEquipment, VitalSignsReadings)."
      },
      {
        id: "lab23-p1-s2-new-item",
        title: "Click '+ New item' in Workspace",
        explain: "We will first create the Lakehouse that stores static hospital operational tables (Hospitals, Departments, Rooms, Patients, Equipment).",
        instruction: "Click '+ New item' in the top workspace toolbar.",
        narration: "Click New item in your workspace toolbar to create the healthcare lakehouse.",
        target: {
          selectors: [
            "[data-testid='new-item-button']",
            "button[aria-label='New item']",
            "button[aria-label*='New item']"
          ],
          roleAndText: [
            { role: "button", text: "New item" }
          ]
        },
        advanceWhenVisible: "[data-testid='new-item-drawer'].open",
        hint: "Make sure you are inside your workspace (not the Fabric Home screen) so '+ New item' is visible."
      },
      {
        id: "lab23-p1-s3-select-lh",
        title: "Select 'Lakehouse' in the New item drawer",
        explain: "A Lakehouse provides OneLake storage for both unstructured CSV files and structured Delta tables.",
        instruction: "In the 'New item' drawer, click the 'Lakehouse' card.",
        narration: "In the New item drawer, click the Lakehouse card.",
        target: {
          selectors: [
            "[data-testid='item-card-lakehouse']",
            "[data-automation-id='new-item-lakehouse']",
            "[data-testid*='lakehouse' i]",
            "button[aria-label*='Lakehouse' i]"
          ],
          roleAndText: [
            { role: "button", text: "Lakehouse" },
            { role: "gridcell", text: "Lakehouse" }
          ]
        },
        hint: "Type 'Lakehouse' in the search box at the top of the New item panel if you don't see it immediately."
      },
      {
        id: "lab23-p1-s4-name-lh",
        title: "Name Lakehouse 'LamnaHealthcareLH' & Click Create",
        explain: "Behind the scenes: Naming the Lakehouse 'LamnaHealthcareLH' provisions OneLake storage and a SQL Analytics Endpoint.",
        instruction: "Click '📋 LamnaHealthcareLH' below to copy, paste it into the Name input, and click 'Create'.",
        narration: "Copy LamnaHealthcareLH using the chip below, paste it into the Name box, and click Create.",
        copyChips: ["LamnaHealthcareLH"],
        target: {
          selectors: [
            "[data-testid='create-lakehouse-submit']",
            "[role='dialog'] button[type='submit']",
            ".ms-Dialog-main button.ms-Button--primary"
          ],
          roleAndText: [
            { role: "button", text: "Create" }
          ]
        },
        hint: "Wait for the New Lakehouse dialog to open, paste 'LamnaHealthcareLH', and click the green 'Create' button."
      },
      {
        id: "lab23-p1-s5-upload-csvs",
        title: "Upload 5 Hospital CSV Files to OneLake",
        explain: "Upload the 5 static reference CSVs into OneLake Files. (Leave VitalSignsReadings.csv for the Eventhouse in Part 2!).",
        instruction: "Click 'Upload files' (or 'Get data' → 'Upload files'), upload all 5 CSVs below, then click '✓ Done — Next Step' when upload finishes:",
        narration: "In the Lakehouse Explorer, click Upload files and upload Hospitals, Departments, Rooms, Patients, and VitalSignEquipment CSV files.",
        manualAdvanceOnly: true,
        downloadLinks: [
          {
            label: "📥 Download sample-data.zip (if not downloaded yet)",
            url: "https://github.com/MicrosoftLearning/mslearn-fabric/raw/main/Allfiles/Labs/23-24/sample-data.zip"
          }
        ],
        referenceTable: {
          headers: ["CSV File to Upload", "Domain Role"],
          rows: [
            ["Hospitals.csv", "Healthcare facilities"],
            ["Departments.csv", "ICU, Emergency, Surgical"],
            ["Rooms.csv", "Hospital rooms"],
            ["Patients.csv", "Patient room assignments"],
            ["VitalSignEquipment.csv", "Assigned patient monitors"]
          ]
        },
        target: {
          selectors: [
            "[data-testid*='upload' i]",
            "button[aria-label*='Upload files' i]",
            "button[aria-label*='Get data' i]"
          ],
          roleAndText: [
            { role: "button", text: "Upload files" },
            { role: "button", text: "Get data" }
          ]
        },
        hint: "Because uploading 5 files takes multiple clicks, this step stays locked on screen until you click 'Next →' at the bottom!"
      },
      {
        id: "lab23-p1-s6-load-to-tables",
        title: "Convert All 5 CSVs to Delta Tables",
        explain: "Behind the scenes: 'Load to Tables' converts raw CSVs in OneLake Files into managed Parquet/Delta tables under Tables/ so Fabric IQ Ontology can bind to them.",
        instruction: "In Explorer → 'Files', click '...' next to each CSV → 'Load to Tables' → 'New table' (check 'Use header for column names'). Copy each lowercase name below:",
        narration: "Expand Files in the left Explorer, click the ellipsis next to each CSV, and select Load to Tables. Use the copy chips below for all 5 lowercase table names.",
        manualAdvanceOnly: true,
        copyChips: [
          "hospitals",
          "departments",
          "rooms",
          "patients",
          "vitalsignequipment"
        ],
        target: {
          selectors: [
            "[data-testid*='files' i]",
            "[aria-label*='Files' i]"
          ],
          roleAndText: [
            { role: "treeitem", text: "Files" },
            { role: "button", text: "Files" }
          ]
        },
        hint: "This step stays locked on screen while you convert all 5 CSVs! Click 'Next →' once all 5 tables appear under 'Tables'."
      }
    ]
  },

  // ===========================================================================
  // MS LEARN LAB 23 — PART 2: EVENTHOUSE & STREAMING DATA (LamnaHealthcareEH)
  // ===========================================================================
  {
    id: "lab23-part2-eventhouse",
    title: "3. [Lab 23 Part 2] Real-Time Eventhouse (KQL)",
    subtitle: "Create LamnaHealthcareEH & ingest VitalSignsReadings.csv time-series data",
    estimatedMinutes: 8,
    steps: [
      {
        id: "lab23-p2-s1-new-eventhouse",
        title: "Return to Workspace & Click '+ New item'",
        explain: "Behind the scenes: While Lakehouse stores static entity attributes, Eventhouse (KQL Database) indexes high-velocity time-series telemetry (heart rate, SpO2) for real-time ontology binding.",
        instruction: "Open your Workspace from the left rail and click '+ New item'.",
        narration: "Part 2: Let's create the Real-Time Eventhouse. Return to your workspace and click New item.",
        target: {
          selectors: [
            "[data-testid='new-item-button']",
            "button[aria-label='New item']",
            "button[aria-label*='New item']"
          ],
          roleAndText: [
            { role: "button", text: "New item" }
          ]
        },
        hint: "Click your workspace icon in the left navigation rail first if you are still inside the Lakehouse Explorer."
      },
      {
        id: "lab23-p2-s2-select-eh",
        title: "Select 'Eventhouse' in the New item drawer",
        explain: "Eventhouse is built for real-time streaming and time-series analytics in Fabric.",
        instruction: "In the 'New item' drawer, click 'Eventhouse'.",
        narration: "In the New item drawer, click Eventhouse.",
        target: {
          selectors: [
            "[data-testid*='eventhouse' i]",
            "button[aria-label*='Eventhouse' i]"
          ],
          roleAndText: [
            { role: "button", text: "Eventhouse" },
            { role: "gridcell", text: "Eventhouse" }
          ]
        },
        hint: "Type 'Eventhouse' into the New item search bar to find it immediately."
      },
      {
        id: "lab23-p2-s3-name-eh",
        title: "Name Eventhouse 'LamnaHealthcareEH' & Click Create",
        explain: "Creating an Eventhouse automatically provisions a default KQL Database with the exact same name (`LamnaHealthcareEH`).",
        instruction: "Click '📋 LamnaHealthcareEH' below to copy, paste it into the Name input, and click 'Create'.",
        narration: "Copy LamnaHealthcareEH using the chip below, paste it into the Name box, and click Create.",
        copyChips: ["LamnaHealthcareEH"],
        target: {
          selectors: [
            "[role='dialog'] button[type='submit']",
            ".ms-Dialog-main button.ms-Button--primary"
          ],
          roleAndText: [
            { role: "button", text: "Create" }
          ]
        },
        hint: "Paste 'LamnaHealthcareEH' into the New Eventhouse dialog and click the green 'Create' button."
      },
      {
        id: "lab23-p2-s4-open-kql-db",
        title: "Ingest 'VitalSignsReadings.csv' into KQL Database",
        explain: "We will load 'VitalSignsReadings.csv' (containing ReadingId, EquipmentId, Timestamp, HeartRate, OxygenSaturation) into a KQL table.",
        instruction: "1) Click 'LamnaHealthcareEH' KQL database → 2) Click 'Get data' → 'Local file' → 3) '+ New table' named 'VitalSignsReadings' → Upload 'VitalSignsReadings.csv' → Finish!",
        narration: "Open the LamnaHealthcareEH KQL database, click Get data then Local file, and create the VitalSignsReadings table.",
        manualAdvanceOnly: true,
        copyChips: ["VitalSignsReadings"],
        target: {
          selectors: [
            "button[aria-label*='Get data' i]",
            "[data-testid*='get-data' i]"
          ],
          roleAndText: [
            { role: "button", text: "Get data" },
            { role: "button", text: "LamnaHealthcareEH" }
          ]
        },
        hint: "This step stays locked on screen while you complete the KQL ingestion wizard! Click 'Next →' once 'VitalSignsReadings' table is created."
      }
    ]
  },

  // ===========================================================================
  // MS LEARN LAB 23 — PART 3: BUILD FABRIC IQ ONTOLOGY, ENTITIES & BINDINGS
  // ===========================================================================
  {
    id: "lab23-part3-ontology",
    title: "4. [Lab 23 Part 3] Build Fabric IQ Ontology",
    subtitle: "Create LamnaHealthcareOntology, 5 Entities, 5 Relationships & Data Bindings",
    estimatedMinutes: 15,
    steps: [
      {
        id: "lab23-p3-s1-new-item",
        title: "In Workspace, Click '+ New item'",
        explain: "Behind the scenes: A Fabric IQ Ontology creates an enterprise semantic graph layer over your OneLake Lakehouse and KQL Eventhouse.",
        instruction: "In your Workspace, click '+ New item' in the top toolbar.",
        narration: "Part 3: In your workspace, click New item in the top toolbar.",
        target: {
          selectors: [
            "[data-testid='new-item-button']",
            "button[aria-label*='New item' i]"
          ],
          roleAndText: [
            { role: "button", text: "New item" }
          ]
        },
        hint: "Return to your Workspace view first so the '+ New item' button is visible."
      },
      {
        id: "lab23-p3-s2-select-ontology",
        title: "Select 'Ontology (preview)' in New item drawer",
        explain: "Ontology (preview) lets you model domain entity types, properties, keys, and semantic relationships.",
        instruction: "In the 'New item' drawer, search for or click 'Ontology (preview)'.",
        narration: "In the New item drawer, click Ontology preview.",
        target: {
          selectors: [
            "[data-testid*='ontology' i]",
            "button[aria-label*='Ontology' i]"
          ],
          roleAndText: [
            { role: "button", text: "Ontology" },
            { role: "gridcell", text: "Ontology" }
          ]
        },
        hint: "Type 'Ontology' in the New item search bar. Ensure 'Enable Ontology item (preview)' is enabled in Tenant Settings."
      },
      {
        id: "lab23-p3-s3-name-ontology",
        title: "Name Ontology 'LamnaHealthcareOntology' & Click Create",
        explain: "This provisions an empty Fabric IQ Ontology canvas ready for your entity model.",
        instruction: "Click '📋 LamnaHealthcareOntology' below to copy, paste it into the Name box in the 'New Ontology' dialog, and click 'Create'.",
        narration: "Copy LamnaHealthcareOntology using the chip below, paste it into the New Ontology dialog, and click Create.",
        copyChips: ["LamnaHealthcareOntology"],
        target: {
          selectors: [
            "[role='dialog'] button[type='submit']",
            ".ms-Dialog-main button.ms-Button--primary"
          ],
          roleAndText: [
            { role: "button", text: "Create" }
          ]
        },
        hint: "Click the '📋 LamnaHealthcareOntology' chip above, paste it into the Name field, and click the green 'Create' button."
      },
      {
        id: "lab23-p3-s4-add-entities",
        title: "Create the 5 Healthcare Entity Types & Keys",
        explain: "Each Entity Type defines domain concepts, typed properties, and a unique Entity Key (`HospitalId`, `DepartmentId`, `RoomId`, `PatientId`, `EquipmentId`).",
        instruction: "Click 'Add entity type' in the top ribbon. Use the copy chips & table below to create all 5 entities and their keys, then click 'Next →' when all 5 are done:",
        narration: "In the Ontology ribbon, click Add entity type. This step stays locked on screen while you use the copy chips and table below to create all 5 entities.",
        manualAdvanceOnly: true,
        copyChips: [
          "Hospital",
          "Department",
          "Room",
          "Patient",
          "VitalSignEquipment",
          "HospitalId",
          "DepartmentId",
          "RoomId",
          "PatientId",
          "EquipmentId"
        ],
        referenceTable: {
          headers: ["Entity (Key)", "Properties (Type: Int / Str / DateTime)"],
          rows: [
            ["Hospital (HospitalId)", "HospitalId(Int), HospitalName(Str), City(Str), State(Str)"],
            ["Department (DepartmentId)", "DepartmentId(Int), DepartmentName(Str), HospitalId(Int), Floor(Int)"],
            ["Room (RoomId)", "RoomId(Int), RoomNumber(Str), DepartmentId(Int), RoomType(Str)"],
            ["Patient (PatientId)", "PatientId(Int), FirstName(Str), LastName(Str), DateOfBirth(DT), AdmissionDate(DT), CurrentRoomId(Int)"],
            ["VitalSignEquipment (EquipmentId)", "EquipmentId(Str), PatientId(Int), EquipmentType(Str), MonitoringStartDate(DT)"]
          ]
        },
        target: {
          selectors: [
            "button[aria-label*='Add entity type' i]"
          ],
          roleAndText: [
            { role: "button", text: "Add entity type" }
          ]
        },
        hint: "🔒 Multi-action step: This step will NOT auto-skip when you click 'Add entity type'—take your time creating all 5 entities, then click 'Next →' below!"
      },
      {
        id: "lab23-p3-s5-add-relationships",
        title: "Add the 5 Semantic Relationship Types",
        explain: "Behind the scenes: Relationships connect nodes in the Fabric Graph (`Hospital → Department → Room ← Patient ← VitalSignEquipment`).",
        instruction: "In the ribbon, click 'Add relationship' and create all 5 relationships in the table below, then click 'Next →':",
        narration: "Click Add relationship in the ribbon and create all five relationships using the copy chips below.",
        manualAdvanceOnly: true,
        copyChips: [
          "contains",
          "has",
          "assignedTo",
          "monitors",
          "locatedIn"
        ],
        referenceTable: {
          headers: ["Relationship", "Origin → Target"],
          rows: [
            ["contains", "Hospital → Department"],
            ["has", "Department → Room"],
            ["assignedTo", "Patient → Room"],
            ["monitors", "VitalSignEquipment → Patient"],
            ["locatedIn", "VitalSignEquipment → Room"]
          ]
        },
        target: {
          selectors: [
            "button[aria-label*='Add relationship' i]"
          ],
          roleAndText: [
            { role: "button", text: "Add relationship" }
          ]
        },
        hint: "🔒 Multi-action step: Take your time adding all 5 relationships, then click 'Next →' when finished."
      },
      {
        id: "lab23-p3-s6-bind-data",
        title: "Bind Entities to Lakehouse & Eventhouse Data",
        explain: "Behind the scenes: 'VitalSignEquipment' uses DUAL binding—Static binding to Lakehouse (`vitalsignequipment`) for device metadata, PLUS Time-series binding to Eventhouse (`VitalSignsReadings`) for live heart rate & SpO2!",
        instruction: "Click '...' on each Entity card → 'Bind data' → 'Add data binding'. Bind static tables from LamnaHealthcareLH, then add the Eventhouse Time-series binding to VitalSignEquipment:",
        narration: "Finally, click the ellipsis on each entity card and select Bind data to link your Lakehouse tables and Eventhouse time-series telemetry.",
        manualAdvanceOnly: true,
        copyChips: [
          "HeartRate",
          "OxygenSaturation",
          "RespiratoryRate",
          "Timestamp"
        ],
        referenceTable: {
          headers: ["Entity", "Source & Binding Type"],
          rows: [
            ["Hospital / Dept / Room / Patient", "LamnaHealthcareLH (Static)"],
            ["VitalSignEquipment (1st)", "LamnaHealthcareLH → vitalsignequipment (Static)"],
            ["VitalSignEquipment (2nd)", "LamnaHealthcareEH → VitalSignsReadings (Time-series)"]
          ]
        },
        target: {
          selectors: [
            "button[aria-label*='Bind data' i]",
            "button[aria-label*='Add data binding' i]"
          ],
          roleAndText: [
            { role: "menuitem", text: "Bind data" },
            { role: "button", text: "Add data binding" }
          ]
        },
        hint: "You must save the Static binding on VitalSignEquipment first before adding the Time-series Eventhouse binding! Click 'Next →' when all bindings are complete."
      }
    ]
  }
];
