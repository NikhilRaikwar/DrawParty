export interface Player {
  id: string;
  name: string;
  avatar: string;
  score: number;
  isHost: boolean;
  isReady: boolean;
  isMuted: boolean;
  isSpeaking: boolean;
  isConnected: boolean;
}

export interface DrawingData {
  type: 'start' | 'draw' | 'end' | 'clear' | 'undo' | 'redo' | 'fill';
  x?: number;
  y?: number;
  color?: string;
  brushSize?: number;
  timestamp: number;
}

export interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  content: string;
  timestamp: number;
  isCorrectGuess?: boolean;
  isSystemMessage?: boolean;
}

export interface GameState {
  phase: 'lobby' | 'wordSelection' | 'drawing' | 'revealing' | 'roundEnd' | 'gameEnd';
  currentRound: number;
  totalRounds: number;
  currentDrawerId: string | null;
  currentWord: string | null;
  wordHint: string;
  timeRemaining: number;
  drawTime: number;
  correctGuessers: string[];
}

export interface RoomSettings {
  maxPlayers: number;
  drawTime: number;
  totalRounds: number;
  isPublic: boolean;
  hintLevel: number; // 0-5
  gameMode: 'normal' | 'hidden' | 'combination';
}

export interface Room {
  id: string;
  code: string;
  hostId: string;
  settings: RoomSettings;
  gameState: GameState;
  createdAt: number;
}

export const AVATARS = [
  '🦊', '🐱', '🐶', '🐼', '🐨', '🦁', '🐯', '🐻', '🐸', '🐵',
  '🦄', '🐲', '🦋', '🐙', '🦀', '🐬', '🦜', '🐧', '🦉', '🐢',
  '🎨', '🎮', '🎯', '🎪', '🎭', '🎸', '🎺', '🎹', '🎧', '🎤'
];

export const DRAWING_COLORS = [
  '#000000', '#FFFFFF', '#C0C0C0', '#808080',
  '#FF0000', '#800000', '#FFFF00', '#808000',
  '#00FF00', '#008000', '#00FFFF', '#008080',
  '#0000FF', '#000080', '#FF00FF', '#800080',
  '#FFA500', '#A52A2A', '#FFC0CB', '#FFD700'
];

export const BRUSH_SIZES = [2, 5, 10, 20, 40];

// Word lists by difficulty
export const WORD_LISTS = {
  easy: [
    'sun', 'moon', 'star', 'tree', 'house', 'car', 'dog', 'cat', 'fish', 'bird',
    'apple', 'banana', 'cake', 'pizza', 'ball', 'hat', 'shoe', 'book', 'phone', 'cup',
    'door', 'window', 'chair', 'table', 'bed', 'cloud', 'rain', 'snow', 'fire', 'water',
    'heart', 'smile', 'eye', 'hand', 'foot', 'flower', 'grass', 'rock', 'key', 'clock'
  ],
  medium: [
    'rainbow', 'butterfly', 'elephant', 'giraffe', 'penguin', 'dolphin', 'octopus',
    'hamburger', 'ice cream', 'popcorn', 'chocolate', 'spaghetti', 'sandwich',
    'guitar', 'piano', 'drums', 'camera', 'telescope', 'microscope', 'compass',
    'rocket', 'airplane', 'helicopter', 'submarine', 'motorcycle', 'skateboard',
    'mountain', 'volcano', 'waterfall', 'island', 'desert', 'jungle', 'castle',
    'wizard', 'dragon', 'unicorn', 'mermaid', 'pirate', 'ninja', 'robot'
  ],
  hard: [
    'constellation', 'archaeology', 'photosynthesis', 'hieroglyphics', 'kaleidoscope',
    'camouflage', 'silhouette', 'architecture', 'symphony', 'choreography',
    'ventriloquist', 'labyrinth', 'hologram', 'origami', 'parkour',
    'bioluminescence', 'metamorphosis', 'pandemonium', 'serendipity', 'wanderlust',
    'time travel', 'black hole', 'parallel universe', 'artificial intelligence',
    'climate change', 'evolution', 'democracy', 'philosophy', 'mythology', 'renaissance'
  ]
};

export const getRandomWords = (count: number = 3): string[] => {
  const allWords = [
    ...WORD_LISTS.easy,
    ...WORD_LISTS.medium,
    ...WORD_LISTS.hard
  ];
  const shuffled = [...allWords].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
};

export const getWordsByDifficulty = (difficulty: 'easy' | 'medium' | 'hard', count: number = 3): string[] => {
  const words = WORD_LISTS[difficulty];
  const shuffled = [...words].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
};

export const generateWordHint = (word: string, level: number): string => {
  if (level === 0) return word.replace(/[a-zA-Z]/g, '_');
  const chars = word.split('');
  const letterIndices = chars.map((c, i) => c !== ' ' ? i : -1).filter(i => i !== -1);
  const revealCount = Math.min(Math.floor(letterIndices.length * (level / 5)), letterIndices.length);
  const shuffledIndices = [...letterIndices].sort(() => Math.random() - 0.5);
  const revealIndices = new Set(shuffledIndices.slice(0, revealCount));
  
  return chars.map((c, i) => {
    if (c === ' ') return ' ';
    return revealIndices.has(i) ? c : '_';
  }).join('');
};
