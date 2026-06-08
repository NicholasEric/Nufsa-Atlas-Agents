/**
 * Core game type definitions for the Hidden Object Detective game.
 * All interfaces are designed for type-safe data-driven gameplay.
 */

// ============================================================================
// Item System Types
// ============================================================================

/**
 * Where an item lives in the game world.
 *  - type "map":  on a tilemap; (x, y) are world pixels in that map.
 *    `area` is the case id (e.g. "japan-2", "autumn").
 *  - type "room": inside a room photo opened from RoomScene; (x, y) are
 *    pixel coords within the room image. `area` is the room image key
 *    (e.g. "room-japan-1").
 */
export interface ItemLocation {
  type: 'map' | 'room';
  area: string;
  x: number;
  y: number;
}

/**
 * Represents a collectible item in the game world.
 * Items live in a global list and know where they belong via `location`.
 */
export interface ItemData {
  /** Unique identifier for this item (e.g., "yukata", "katana") */
  id: string;
  /** Display name shown in UI (e.g., "Bloody Yukata") */
  name: string;
  /** Description text shown when player clicks the item in the list */
  description: string;
  /** Where this item lives (which map or room, and where within it) */
  location: ItemLocation;
  /** Phaser texture key for the item sprite */
  spriteKey: string;
  /** Path to the PNG asset under public/assets/ (e.g., "items/japanese-yukata.png"). If missing or fails to load, a placeholder is generated. */
  assetPath?: string;
  /** Whether this item has been collected by the player */
  collected: boolean;
}

// ============================================================================
// Case/Level System Types
// ============================================================================

/**
 * Represents a single map / level configuration. Items are stored in a
 * separate global list and reference their case via `location.area`.
 */
export interface CaseData {
  /** Location name (e.g., "Kyoto, Japan") */
  location: string;
  /** Time limit in seconds for the case */
  timeLimitSeconds: number;
  /** Key for the map asset to load */
  mapKey: string;
  /** Optional ambient audio track key */
  ambientAudioKey?: string;
  /** Case ID to travel to when player presses the travel button while standing on a HiddenMove tile. */
  portalDestination?: string;
}

/**
 * Top-level shape of cases.json. Items are global; cases are map config.
 */
export interface GameConfig {
  items: ItemData[];
  cases: { [caseId: string]: CaseData };
}

// ============================================================================
// Player System Types
// ============================================================================

/**
 * The four cardinal directions the player can face.
 * Used for detection cone calculation and sprite flipping.
 */
export type FacingDirection = 'up' | 'down' | 'left' | 'right';

/**
 * Current state of the player character.
 */
export interface PlayerState {
  /** Whether the player is currently moving */
  isMoving: boolean;
  /** Direction the player is facing (last movement direction) */
  facingDirection: FacingDirection;
  /** Movement speed in pixels per second */
  speed: number;
}

/**
 * Configuration for the player controller.
 */
export interface PlayerConfig {
  /** Starting X position */
  startX: number;
  /** Starting Y position */
  startingY: number;
  /** Movement speed */
  speed: number;
  /** Texture key for the player sprite */
  spriteKey: string;
}

// ============================================================================
// Detection System Types
// ============================================================================

/**
 * Result of a detection attempt.
 */
export interface DetectionResult {
  /** Whether an item was detected */
  found: boolean;
  /** The detected item data, if any */
  item: ItemData | null;
  /** Distance to the detected item in pixels */
  distance: number;
}

/**
 * Configuration for the detection system.
 */
export interface DetectionConfig {
  /** How far the player can detect items (in pixels) */
  range: number;
  /** Width of detection cone in degrees */
  coneAngle: number;
}

// ============================================================================
// Game Flow Types
// ============================================================================

/**
 * Possible game states.
 */
export type GameState = 'playing' | 'won' | 'lost';

/**
 * Result of a completed game.
 */
export interface GameResult {
  /** Whether the player won */
  success: boolean;
  /** Number of items found */
  itemsFound: number;
  /** Total items available */
  totalItems: number;
  /** Time remaining when game ended (in seconds) */
  timeRemaining: number;
}

// ============================================================================
// Scene Keys
// ============================================================================

/**
 * Enum for scene identification.
 * Use these keys when starting, stopping, or switching scenes.
 */
export enum SceneKeys {
  Boot = 'BootScene',
  Game = 'GameScene',
  Result = 'ResultScene',
  Room = 'RoomScene',
}

// ============================================================================
// Asset Keys
// ============================================================================

/**
 * Enum for texture/asset keys.
 * Centralized to prevent typos and make refactoring easier.
 */
export enum AssetKeys {
  // Maps
  JapanMap = 'japan-map',
  JapanTileset = 'tiles-japan',

  // Character
  Player = 'player',

  // UI
  MagnifierButton = 'magnifier-btn',
  PanelBackground = 'panel-bg',

  // Items 

  // Audio
  AmbientJapan = 'ambient-japan',
  CollectSFX = 'collect-sfx',
  DetectSFX = 'detect-sfx',
  WinSFX = 'win-sfx',
  LoseSFX = 'lose-sfx',
}
