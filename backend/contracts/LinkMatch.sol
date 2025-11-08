// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title LinkMatch - Encrypted Link Matching Game
/// @notice A game where players match pairs and submit encrypted scores
/// @dev All game scores are stored and processed in encrypted form using FHEVM
contract LinkMatch is ZamaEthereumConfig {
    // Structure to store encrypted game result
    struct EncryptedGameResult {
        euint32 score;         // Average matches per second (matches / timeSeconds) (encrypted)
        address player;        // Player address
        uint256 timestamp;     // Submission timestamp
    }

    // Mapping from player address to their encrypted game result
    mapping(address => EncryptedGameResult) public playerResults;
    
    // Array to store all player addresses for ranking
    address[] public players;
    
    // Mapping to check if player has submitted a result
    mapping(address => bool) public hasSubmitted;

    // Events
    event GameResultSubmitted(address indexed player, uint256 timestamp);
    event LeaderboardUpdated(); // Emitted when leaderboard data changes

    /// @notice Submit encrypted game result (score = matches / timeSeconds)
    /// @param encryptedScore Encrypted average matches per second (score)
    /// @param scoreProof Proof for encrypted score
    /// @dev Only keeps the highest score for each player (not the latest)
    function submitGameResult(
        externalEuint32 encryptedScore,
        bytes calldata scoreProof
    ) external {
        // Convert external encrypted value to internal euint32
        euint32 newScore = FHE.fromExternal(encryptedScore, scoreProof);

        // Grant ACL permissions for the new encrypted value
        FHE.allowThis(newScore);
        FHE.allow(newScore, msg.sender);

        // If first submission, add to players array
        if (!hasSubmitted[msg.sender]) {
            players.push(msg.sender);
            hasSubmitted[msg.sender] = true;
            
            // Store the first score directly
            playerResults[msg.sender] = EncryptedGameResult({
                score: newScore,
                player: msg.sender,
                timestamp: block.timestamp
            });
        } else {
            // For subsequent submissions, keep only the highest score
            euint32 currentScore = playerResults[msg.sender].score;
            euint32 highestScore = FHE.max(newScore, currentScore);
            
            // Store the highest score (FHE.max automatically selects the maximum)
            playerResults[msg.sender] = EncryptedGameResult({
                score: highestScore,
                player: msg.sender,
                timestamp: block.timestamp
            });
            
            // Grant ACL permissions for the highest score result
            FHE.allowThis(highestScore);
            FHE.allow(highestScore, msg.sender);
        }

        emit GameResultSubmitted(msg.sender, block.timestamp);
    }

    /// @notice Get encrypted game result for a player
    /// @param player Address of the player
    /// @return score Encrypted average matches per second
    function getPlayerResult(address player) 
        external 
        view 
        returns (euint32 score) 
    {
        require(hasSubmitted[player], "Player has not submitted a result");
        EncryptedGameResult memory result = playerResults[player];
        return result.score;
    }

    /// @notice Get total number of players
    /// @return Total number of players who have submitted results
    function getPlayerCount() external view returns (uint256) {
        return players.length;
    }

    /// @notice Get player address by index
    /// @param index Index in the players array
    /// @return Player address
    function getPlayerByIndex(uint256 index) external view returns (address) {
        require(index < players.length, "Index out of bounds");
        return players[index];
    }

    /// @notice Check if a player has submitted a result
    /// @param player Address of the player
    /// @return True if player has submitted a result
    function checkPlayerSubmitted(address player) external view returns (bool) {
        return hasSubmitted[player];
    }

    /// @notice Get all players' encrypted scores for leaderboard
    /// @return playerAddresses Array of player addresses
    /// @return encryptedScores Array of encrypted scores
    /// @dev Frontend should decrypt and sort these scores to display top 10
    function getAllEncryptedScores() 
        external 
        view 
        returns (address[] memory playerAddresses, euint32[] memory encryptedScores) 
    {
        uint256 count = players.length;
        playerAddresses = new address[](count);
        encryptedScores = new euint32[](count);
        
        for (uint256 i = 0; i < count; i++) {
            address player = players[i];
            playerAddresses[i] = player;
            encryptedScores[i] = playerResults[player].score;
        }
        
        return (playerAddresses, encryptedScores);
    }
}

