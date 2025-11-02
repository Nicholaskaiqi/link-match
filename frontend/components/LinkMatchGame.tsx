"use client";

import { useState, useEffect, useCallback } from "react";

type Cell = {
  id: number;
  value: number; // pattern index; 0 means eliminated
  row: number;
  col: number;
};

type GameState = "waiting" | "playing";
type Difficulty = "easy" | "medium" | "hard";

interface LinkMatchGameProps {
  onGameComplete: (matches: number, timeSeconds: number) => void;
  disabled?: boolean;
}

// Difficulty configuration
const DIFFICULTY_CONFIG: Record<Difficulty, { rows: number; cols: number; label: string }> = {
  easy: { rows: 4, cols: 4, label: "Easy" },
  medium: { rows: 6, cols: 6, label: "Medium" },
  hard: { rows: 8, cols: 8, label: "Hard" },
};

// Pattern list (emoji; duplicates allowed)
const PATTERNS = [
  "🍎", "🍌", "🍇", "🍊", "🍓", "🥝", "🍑", "🍒", "🥭", "🍉",
  "🍐", "🍋", "🍈", "🍏", "🥑", "🍅", "🥝", "🥥", "🍇", "🍉",
  "🍊", "🍋", "🍌", "🍍", "🥭", "🍎", "🍏", "🍐", "🍑", "🍒",
  "🍓", "🥝", "🍅", "🥥", "🥑", "🍆", "🥔", "🥕", "🌽", "🌶",
];

export const LinkMatchGame: React.FC<LinkMatchGameProps> = ({
  onGameComplete,
  disabled = false,
}) => {
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [grid, setGrid] = useState<Cell[]>([]);
  const [selectedCells, setSelectedCells] = useState<number[]>([]);
  const [matches, setMatches] = useState(0);
  const [gameState, setGameState] = useState<GameState>("waiting");
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  const config = DIFFICULTY_CONFIG[difficulty];
  const ROWS = config.rows;
  const COLS = config.cols;
  const TOTAL_CELLS = ROWS * COLS;

  // Generate game grid
  const generateGrid = useCallback(() => {
    // Calculate number of pairs (ensure even)
    const pairsNeeded = Math.floor(TOTAL_CELLS / 2);
    
    // Generate pairs using emoji patterns (duplicates allowed)
    const values: number[] = [];
    for (let i = 0; i < pairsNeeded; i++) {
      // Use modulo to keep index within range; allow duplicates
      const patternIndex = (i % PATTERNS.length) + 1;
      values.push(patternIndex, patternIndex);
    }
    
    // If total is odd, add an extra pattern
    if (TOTAL_CELLS % 2 === 1) {
      values.push(1);
    }
    
    // Shuffle values
    const shuffled = values.sort(() => Math.random() - 0.5);
    
    // Build grid
    const newGrid: Cell[] = [];
    let id = 0;
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        newGrid.push({
          id: id++,
          value: shuffled[id - 1] || 0,
          row,
          col,
        });
      }
    }
    
    return newGrid;
  }, [ROWS, COLS, TOTAL_CELLS]);

  const startGame = useCallback(() => {
    const newGrid = generateGrid();
    setGrid(newGrid);
    setSelectedCells([]);
    setMatches(0);
    setGameState("playing");
    setStartTime(Date.now());
    setElapsedTime(0);
  }, [generateGrid]);

  const endGame = useCallback(() => {
    if (gameState === "playing" && startTime) {
      const timeSeconds = Math.floor((Date.now() - (startTime || Date.now())) / 1000);
      onGameComplete(matches, timeSeconds);
      // After ending the game, reset to initial state and allow selecting difficulty again
      setGameState("waiting");
      setGrid([]);
      setSelectedCells([]);
      setMatches(0);
      setStartTime(null);
      setElapsedTime(0);
    }
  }, [gameState, startTime, matches, onGameComplete]);

  useEffect(() => {
    if (gameState === "playing" && startTime) {
      const interval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [gameState, startTime]);

  // Check if the game is completed
  useEffect(() => {
    if (gameState === "playing") {
      const remainingCells = grid.filter(cell => cell.value !== 0);
      if (remainingCells.length === 0) {
        const timeSeconds = Math.floor((Date.now() - (startTime || Date.now())) / 1000);
        onGameComplete(matches, timeSeconds);
        // After completing the game, reset to initial state and allow selecting difficulty again
        setGameState("waiting");
        setGrid([]);
        setSelectedCells([]);
        setMatches(0);
        setStartTime(null);
        setElapsedTime(0);
      }
    }
  }, [grid, matches, gameState, startTime, onGameComplete]);

  const handleCellClick = useCallback(
    (cellId: number) => {
      if (disabled || gameState !== "playing") return;

      const cell = grid.find(c => c.id === cellId);
      if (!cell || cell.value === 0) return; // Eliminated cells cannot be clicked

      // If clicking an already selected cell, deselect it
      if (selectedCells.includes(cellId)) {
        setSelectedCells(selectedCells.filter(id => id !== cellId));
        return;
      }

      // If two cells are already selected, reset selection first
      if (selectedCells.length >= 2) {
        setSelectedCells([cellId]);
        return;
      }

      const newSelected = [...selectedCells, cellId];
      setSelectedCells(newSelected);

      // When two cells are selected, check if patterns match
      if (newSelected.length === 2) {
        const [firstId, secondId] = newSelected;
        const firstCell = grid.find(c => c.id === firstId)!;
        const secondCell = grid.find(c => c.id === secondId)!;

        if (firstCell.value === secondCell.value) {
          // Patterns match; eliminate both cells
          setTimeout(() => {
            setGrid(prevGrid =>
              prevGrid.map(cell =>
                cell.id === firstId || cell.id === secondId
                  ? { ...cell, value: 0 }
                  : cell
              )
            );
            setSelectedCells([]);
            setMatches(prev => prev + 1);
          }, 300);
        } else {
          // Patterns don't match; reset selection
          setTimeout(() => {
            setSelectedCells([]);
          }, 500);
        }
      }
    },
    [grid, selectedCells, disabled, gameState]
  );

  // Get pattern display (emoji)
  const getPatternDisplay = (value: number): string => {
    if (value === 0) return "";
    // Use emoji as pattern; value starts at 1
    return PATTERNS[value - 1] || "";
  };

  return (
    <div className="w-full mx-auto">
      {gameState === "waiting" ? (
        /* Game Setup Screen */
        <div className="text-center py-8">
          <div className="mb-8">
            <div className="text-6xl mb-4">🎮</div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">
              Ready to Play?
            </h3>
            <p className="text-gray-600">
              Choose your difficulty level and start matching tiles
            </p>
          </div>

          {/* Difficulty selection */}
          <div className="mb-8">
            <p className="text-lg font-bold text-gray-900 mb-4">Select Difficulty Level</p>
            <div className="flex justify-center gap-3">
              {(["easy", "medium", "hard"] as Difficulty[]).map((diff) => {
                const config = DIFFICULTY_CONFIG[diff];
                return (
                  <button
                    key={diff}
                    onClick={() => setDifficulty(diff)}
                    disabled={disabled}
                    className={`px-6 py-4 rounded-xl font-bold text-lg transition-all border-2 ${
                      difficulty === diff
                        ? "bg-[#0F4C81] text-white border-[#0F4C81] shadow-lg transform scale-105"
                        : "bg-white text-gray-700 border-gray-300 hover:border-[#0F4C81] hover:shadow-md"
                    } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    <div>{config.label}</div>
                    <div className="text-xs mt-1 opacity-80">
                      {config.rows}×{config.cols} Grid
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Game Rules */}
          <div className="border-2 border-[#065F46] bg-green-50 rounded-xl p-6 mb-6 max-w-2xl mx-auto">
            <h4 className="font-bold text-lg text-gray-900 mb-3 flex items-center justify-center">
              <span className="mr-2">📜</span>
              Game Rules
            </h4>
            <ul className="text-left text-gray-700 space-y-2 max-w-md mx-auto">
              <li className="flex items-start">
                <span className="text-[#0F4C81] font-bold mr-2">1.</span>
                <span>Click on two tiles to reveal their patterns</span>
              </li>
              <li className="flex items-start">
                <span className="text-[#0F4C81] font-bold mr-2">2.</span>
                <span>If patterns match, both tiles will be eliminated</span>
              </li>
              <li className="flex items-start">
                <span className="text-[#0F4C81] font-bold mr-2">3.</span>
                <span>Clear all tiles as quickly as possible to get a high score</span>
              </li>
              <li className="flex items-start">
                <span className="text-[#0F4C81] font-bold mr-2">4.</span>
                <span>Your score is calculated as matches per second</span>
              </li>
            </ul>
          </div>

          <button
            onClick={startGame}
            disabled={disabled}
            className="btn-success text-xl px-12 py-4 inline-flex items-center"
          >
            <span className="mr-2">▶️</span>
            Start Game
          </button>
        </div>
      ) : (
        /* Game Playing Screen */
        <div style={{ transform: 'scale(0.6)', transformOrigin: 'top center' }}>
          {/* Game info and controls */}
          <div className="flex justify-between items-center mb-6 bg-gray-50 border-2 border-gray-200 rounded-xl p-4">
            <div className="flex gap-6">
              <div className="text-center">
                <div className="text-sm text-gray-600 mb-1">Matches</div>
                <div className="text-3xl font-bold text-[#065F46]">{matches}</div>
              </div>
              <div className="h-12 w-px bg-gray-300"></div>
              <div className="text-center">
                <div className="text-sm text-gray-600 mb-1">Time</div>
                <div className="text-3xl font-bold text-[#0F4C81]">{elapsedTime}s</div>
              </div>
            </div>
            <button
              onClick={endGame}
              disabled={disabled}
              className="btn-danger"
            >
              <span className="mr-2">⏹️</span>
              End Game
            </button>
          </div>

          {/* Game Grid */}
          <div
            className="grid gap-2 bg-gray-100 p-4 rounded-xl border-2 border-gray-300"
            style={{
              gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`,
            }}
          >
            {grid.map((cell) => {
              const isSelected = selectedCells.includes(cell.id);
              const isEliminated = cell.value === 0;

              return (
                <div
                  key={cell.id}
                  onClick={() => handleCellClick(cell.id)}
                  className={`aspect-square flex items-center justify-center text-5xl font-bold rounded-lg cursor-pointer transition-all ${
                    isEliminated
                      ? "bg-transparent opacity-0"
                      : isSelected
                      ? "bg-[#FFD700] ring-4 ring-[#0F4C81] shadow-xl transform scale-105"
                      : "bg-white hover:bg-blue-50 hover:shadow-lg border-2 border-gray-300 hover:border-[#0F4C81] shadow-sm"
                  } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
                >
                  {!isEliminated && getPatternDisplay(cell.value)}
                </div>
              );
            })}
          </div>

          {/* Game Tips */}
          <div className="mt-4 p-3 bg-blue-50 border border-[#0F4C81] rounded-lg text-center">
            <p className="text-sm text-gray-700">
              💡 <strong>Tip:</strong> Click two tiles to check if they match. Yellow highlight shows selected tiles.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
