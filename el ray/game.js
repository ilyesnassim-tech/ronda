/**
 * ENGINE DE JEU COMPLET - EL REY 
 * Système Automatisé Front-End & IA Tactique (Règles Ronda)
 */

// Cartographie exacte de ton image deck.jpg (4 lignes de couleurs)
const SUIT_DEFINITIONS = [
    { name: 'Kabou', rowIndex: 0 }, // Ligne 1 : Bâtons
    { name: 'Espé', rowIndex: 1 },  // Ligne 2 : Épées
    { name: 'Yoro', rowIndex: 2 },  // Ligne 3 : Or/Deniers
    { name: 'Copa', rowIndex: 3 }   // Ligne 4 : Coupes
];

// Les 10 colonnes de ton image (de gauche à droite)
const CARD_VALUES = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];

// Grille de calcul des points à la fin (Règles officielles de comptage)
const POINTS_TABLE = { 1: 11, 7: 10, 12: 4, 11: 3, 10: 2, 6: 0, 5: 0, 4: 0, 3: 0, 2: 0 };

// Grille de puissance absolue pour remporter les combats (Force)
const POWER_TABLE = { 1: 110, 7: 100, 12: 40, 11: 30, 10: 20, 6: 6, 5: 5, 4: 4, 3: 3, 2: 2 };

// ÉTAT DU JEU CONTROLLÉ (STATE ENGINE)
let state = {
    masterDeck: [],
    atoutCard: null,
    playerHand: [],
    aiHand: [],
    playerScore: 0,
    aiScore: 0,
    currentTrick: {
        playerCard: null,
        aiCard: null,
        leadByPlayer: true
    },
    isPlayerTurn: true,
    isPhaseDemandeActive: false,
    botStrategyMode: 'ilyes',
    systemMutexLock: false
};

// INITIALISATION DU JEU VIA LE MENU
document.addEventListener('DOMContentLoaded', () => {
    const startButton = document.getElementById('btn-start-game');
    if (startButton) {
        startButton.addEventListener('click', processMenuFormSubmission);
    }
});

function processMenuFormSubmission() {
    const selectedBotInput = document.querySelector('input[name="bot-intelligence"]:checked');
    if (selectedBotInput) {
        state.botStrategyMode = selectedBotInput.value;
    }
    
    document.getElementById('main-menu').classList.remove('active');
    document.getElementById('game-screen').classList.add('active');
    
    const uppercaseBotName = state.botStrategyMode === 'ilyes' ? 'ILYES' : 'FOUAD';
    document.getElementById('ai-label-name').innerText = `BOT: ${uppercaseBotName}`;
    document.getElementById('label-slot-ai').innerText = uppercaseBotName;
    
    executeNewGameSetup();
}

/**
 * Génère le deck, le mélange et distribue 6 cartes à chacun
 */
function executeNewGameSetup() {
    state.masterDeck = [];
    state.playerScore = 0;
    state.aiScore = 0;
    state.isPhaseDemandeActive = false;
    state.isPlayerTurn = true;
    state.systemMutexLock = false;
    state.currentTrick = { playerCard: null, aiCard: null, leadByPlayer: true };

    // Construction du paquet de 40 cartes
    SUIT_DEFINITIONS.forEach(suit => {
        CARD_VALUES.forEach(val => {
            state.masterDeck.push({
                suit: suit.name,
                row: suit.rowIndex,
                val: val,
                points: POINTS_TABLE[val],
                power: POWER_TABLE[val]
            });
        });
    });

    // Mélange Fisher-Yates aléatoire
    state.masterDeck.sort(() => Math.random() - 0.5);

    // Distribution
    state.playerHand = state.masterDeck.splice(0, 6);
    state.aiHand = state.masterDeck.splice(0, 6);

    // Retournement de l'atout
    state.atoutCard = state.masterDeck[state.masterDeck.length - 1];

    updateStatusNotification("La bataille commence. C'est à vous d'ouvrir le bal !");
    refreshGraphicsLayout();
}

function updateStatusNotification(message) {
    document.getElementById('txt-game-status').innerText = message;
}

/**
 * Algorithme mathématique de découpage CSS background-position
 */
function calculateCardSpriteOffset(cardObject) {
    const columnIndex = CARD_VALUES.indexOf(cardObject.val);
    const posX = ((columnIndex / 9) * 100).toFixed(3);
    const posY = ((cardObject.row / 3) * 100).toFixed(3);
    return `${posX}% ${posY}%`;
}

/**
 * Restriction de la Phase Finale de Demande (Suivre la couleur si possible)
 */
function compileValidSelectionSublist(handArray, openCard) {
    if (!state.isPhaseDemandeActive || !openCard) {
        return [...handArray];
    }
    const matchingSuitCards = handArray.filter(card => card.suit === openCard.suit);
    if (matchingSuitCards.length > 0) {
        return matchingSuitCards;
    }
    return [...handArray];
}

/**
 * FONCTION DE COMPORTEMENT : Échange du 6 d'atout (Joueur Humain)
 */
function tryExchangingSixForAtout() {
    if (state.isPhaseDemandeActive || !state.atoutCard) return;

    // L'atout sur table doit être supérieur au 6 (1, 7, 10, 11, 12)
    const validValuesToSwap = [1, 7, 10, 11, 12];
    if (!validValuesToSwap.includes(state.atoutCard.val)) return;

    // On cherche le 6 de la couleur de l'atout dans la main du joueur
    const sixAtoutIndex = state.playerHand.findIndex(card => card.suit === state.atoutCard.suit && card.val === 6);

    if (sixAtoutIndex !== -1) {
        const oldAtout = state.atoutCard;
        const playerSix = state.playerHand.splice(sixAtoutIndex, 1)[0];

        // Le 6 remplace l'atout sur table et sous le deck
        state.atoutCard = playerSix;
        state.masterDeck[state.masterDeck.length - 1] = playerSix;

        // Le joueur récupère la grosse carte d'atout dans sa main
        state.playerHand.push(oldAtout);

        updateStatusNotification(`🔄 Vous avez échangé votre 6 d'atout contre le ${oldAtout.val} d'atout !`);
        refreshGraphicsLayout();
    }
}

/**
 * GESTION DE L'ÉCHANGE DU 6 D'ATOUT PAR L'IA
 */
function handleAiAtoutExchangeCheck() {
    if (state.isPhaseDemandeActive || !state.atoutCard) return;
    const validValuesToSwap = [1, 7, 10, 11, 12];
    if (!validValuesToSwap.includes(state.atoutCard.val)) return;

    const sixAtoutIndex = state.aiHand.findIndex(card => card.suit === state.atoutCard.suit && card.val === 6);
    
    if (sixAtoutIndex !== -1) {
        const oldAtout = state.atoutCard;
        const aiSix = state.aiHand.splice(sixAtoutIndex, 1)[0];

        state.atoutCard = aiSix;
        state.masterDeck[state.masterDeck.length - 1] = aiSix;
        state.aiHand.push(oldAtout);

        const botName = state.botStrategyMode === 'ilyes' ? 'Ilyes' : 'Fouad';
        updateStatusNotification(`🔄 ${botName} a échangé son 6 d'atout contre le ${oldAtout.val} d'atout !`);
    }
}

/**
 * RECONSTRUCTION ET RENDU DU COMPOSANT VISUEL
 */
function refreshGraphicsLayout() {
    document.getElementById('txt-player-score').innerText = state.playerScore;
    document.getElementById('txt-ai-score').innerText = state.aiScore;
    
    const deckBadge = document.getElementById('badge-deck-count');
    const backPile = document.getElementById('deck-back-pile');
    const atoutDiv = document.getElementById('card-atout-display');

    if (state.isPhaseDemandeActive) {
        deckBadge.innerText = "PHASE FINALE : OBLIGATION DE SUIVRE LA COULEUR";
        if (backPile) backPile.style.display = 'none';
        if (atoutDiv) atoutDiv.style.display = 'none';
    } else {
        deckBadge.innerText = `Cartes restantes dans la pioche : ${state.masterDeck.length}`;
        if (backPile) backPile.style.display = 'block'; 
        if (atoutDiv && state.atoutCard) {
            atoutDiv.style.display = 'block';
            atoutDiv.style.backgroundPosition = calculateCardSpriteOffset(state.atoutCard);
            
            // Configuration du clic sur l'atout si l'échange est légitime
            const hasSix = state.playerHand.some(card => card.suit === state.atoutCard.suit && card.val === 6);
            const validValuesToSwap = [1, 7, 10, 11, 12];
            
            if (hasSix && validValuesToSwap.includes(state.atoutCard.val)) {
                atoutDiv.classList.add('can-exchange-atout'); 
                atoutDiv.onclick = tryExchangingSixForAtout;
                atoutDiv.title = "Cliquez pour échanger votre 6 d'atout !";
            } else {
                atoutDiv.classList.remove('can-exchange-atout');
                atoutDiv.onclick = null;
                atoutDiv.title = "";
            }
        }
    }

    const leadCard = state.currentTrick.leadByPlayer ? null : state.currentTrick.aiCard;
    const allowedPlayerCards = compileValidSelectionSublist(state.playerHand, leadCard);

    // RENDER MAIN DU JOUEUR HUMAIN
    const playerHandContainer = document.getElementById('container-player-hand');
    playerHandContainer.innerHTML = '';
    state.playerHand.forEach((card, index) => {
        const cardElement = document.createElement('div');
        const isSelectable = allowedPlayerCards.includes(card) && state.isPlayerTurn && !state.systemMutexLock;
        
        cardElement.className = isSelectable ? 'game-card' : 'game-card invalid-to-play';
        cardElement.style.backgroundPosition = calculateCardSpriteOffset(card);
        
        if (isSelectable) {
            cardElement.addEventListener('click', () => triggerPlayerCardCommit(index));
        }
        playerHandContainer.appendChild(cardElement);
    });

    // RENDER MAIN DE L'IA (DOS CACHÉ)
    const aiHandContainer = document.getElementById('container-ai-hand');
    aiHandContainer.innerHTML = '';
    state.aiHand.forEach(() => {
        const backCardElement = document.createElement('div');
        backCardElement.className = 'game-card card-back-style';
        aiHandContainer.appendChild(backCardElement);
    });

    // RENDU DU PLI JOUEUR SUR LE TAPIS
    const playerSlot = document.getElementById('slot-player-trick');
    playerSlot.innerHTML = '';
    if (state.currentTrick.playerCard) {
        const pCardImg = document.createElement('div');
        pCardImg.className = 'game-card';
        pCardImg.style.backgroundPosition = calculateCardSpriteOffset(state.currentTrick.playerCard);
        playerSlot.appendChild(pCardImg);
    }

    // RENDU DU PLI IA SUR LE TAPIS
    const aiSlot = document.getElementById('slot-ai-trick');
    aiSlot.innerHTML = '';
    if (state.currentTrick.aiCard) {
        const aCardImg = document.createElement('div');
        aCardImg.className = 'game-card';
        aCardImg.style.backgroundPosition = calculateCardSpriteOffset(state.currentTrick.aiCard);
        aiSlot.appendChild(aCardImg);
    }
}

/**
 * Déclenchement de l'action de jeu
 */
function triggerPlayerCardCommit(cardIndex) {
    if (!state.isPlayerTurn || state.systemMutexLock || state.currentTrick.playerCard) return;

    state.currentTrick.playerCard = state.playerHand.splice(cardIndex, 1)[0];
    const botName = state.botStrategyMode === 'ilyes' ? 'Ilyes' : 'Fouad';

    if (state.currentTrick.aiCard === null) {
        state.currentTrick.leadByPlayer = true;
        state.isPlayerTurn = false;
        updateStatusNotification(`Vous jouez le ${state.currentTrick.playerCard.val}. Au tour de ${botName}...`);
        refreshGraphicsLayout();
        setTimeout(executeAiBrainProcessing, 1000); 
    } else {
        refreshGraphicsLayout();
        state.systemMutexLock = true;
        setTimeout(concludeActiveTrickEvaluation, 2000); 
    }
}

/**
 * Calcul de l'intelligence artificielle
 */
function executeAiBrainProcessing() {
    if (state.aiHand.length === 0) return;

    // L'IA applique sa vérification d'échange d'atout avant de choisir sa carte
    handleAiAtoutExchangeCheck();

    const leadCard = state.currentTrick.leadByPlayer ? state.currentTrick.playerCard : null;
    const legitimateAiOptions = compileValidSelectionSublist(state.aiHand, leadCard);
    let chosenIndex = 0;

    const botName = state.botStrategyMode === 'ilyes' ? 'Ilyes' : 'Fouad';

    if (state.botStrategyMode === 'ilyes') {
        chosenIndex = Math.floor(Math.random() * legitimateAiOptions.length);
    } else {
        if (leadCard) {
            // Recherche d'une carte gagnante (Atout ou Même couleur plus forte)
            let winningCombos = legitimateAiOptions.filter(card => {
                const cutsWithAtout = (card.suit === state.atoutCard.suit && leadCard.suit !== state.atoutCard.suit);
                const winsWithHigherPower = (card.suit === leadCard.suit && card.power > leadCard.power);
                return cutsWithAtout || winsWithHigherPower;
            });

            if (winningCombos.length > 0) {
                if (leadCard.points >= 2) {
                    winningCombos.sort((a, b) => a.power - b.power);
                    chosenIndex = legitimateAiOptions.indexOf(winningCombos[0]);
                } else {
                    legitimateAiOptions.sort((a, b) => a.power - b.power);
                    chosenIndex = 0;
                }
            } else {
                legitimateAiOptions.sort((a, b) => a.power - b.power);
                chosenIndex = 0;
            }
        } else {
            let safeCards = legitimateAiOptions.filter(c => c.points === 0);
            if (safeCards.length > 0) {
                chosenIndex = legitimateAiOptions.indexOf(safeCards[Math.floor(Math.random() * safeCards.length)]);
            } else {
                legitimateAiOptions.sort((a, b) => a.power - b.power);
                chosenIndex = 0;
            }
        }
    }

    const finalCard = legitimateAiOptions[chosenIndex];
    state.currentTrick.aiCard = state.aiHand.splice(state.aiHand.indexOf(finalCard), 1)[0];

    if (state.currentTrick.playerCard === null) {
        state.currentTrick.leadByPlayer = false;
        state.isPlayerTurn = true;
        updateStatusNotification(`${botName} a ouvert le pli. À votre tour de répondre !`);
        refreshGraphicsLayout();
    } else {
        refreshGraphicsLayout();
        state.systemMutexLock = true;
        setTimeout(concludeActiveTrickEvaluation, 2000); 
    }
}

/**
 * Résolution algorithmique du pli (REGLES RONDA CORRIGÉES)
 */
function concludeActiveTrickEvaluation() {
    const playerCard = state.currentTrick.playerCard;
    const aiCard = state.currentTrick.aiCard;
    const botName = state.botStrategyMode === 'ilyes' ? 'Ilyes' : 'Fouad';

    const opener = state.currentTrick.leadByPlayer ? playerCard : aiCard;
    const responder = state.currentTrick.leadByPlayer ? aiCard : playerCard;
    
    let openerWon = true; // Par défaut, celui qui ouvre gagne le pli

    // L'ouvreur perd UNIQUEMENT SI le répondant coupe à l'atout, ou fournit la MÊME couleur en plus fort
    if (responder.suit === state.atoutCard.suit && opener.suit !== state.atoutCard.suit) {
        openerWon = false; // Le répondant coupe avec de l'atout
    } else if (responder.suit === opener.suit && responder.power > opener.power) {
        openerWon = false; // Le répondant fournit la même couleur avec une carte plus puissante
    }
    // Si le répondant met une autre couleur non-atout, openerWon reste vrai (Règle Ronda)

    const playerWon = state.currentTrick.leadByPlayer ? openerWon : !openerWon;
    const totalTrickPoints = playerCard.points + aiCard.points;

    if (playerWon) {
        state.playerScore += totalTrickPoints;
        state.isPlayerTurn = true; 
        updateStatusNotification(`✅ Pli gagné (+${totalTrickPoints} pts) ! À vous de relancer.`);
    } else {
        state.aiScore += totalTrickPoints;
        state.isPlayerTurn = false; 
        updateStatusNotification(`❌ ${botName} gagne le pli (+${totalTrickPoints} pts).`);
    }

    // DISTRIBUTION DE LA PIOCHE APRÈS LE COMBAT
    if (state.masterDeck.length > 0) {
        if (playerWon) {
            state.playerHand.push(state.masterDeck.pop());
            state.aiHand.push(state.masterDeck.pop());
        } else {
            state.aiHand.push(state.masterDeck.pop());
            state.playerHand.push(state.masterDeck.pop());
        }
    } else {
        state.isPhaseDemandeActive = true;
    }

    state.currentTrick = { playerCard: null, aiCard: null, leadByPlayer: state.isPlayerTurn };
    state.systemMutexLock = false;
    refreshGraphicsLayout();

    if (!state.isPlayerTurn && state.aiHand.length > 0) {
        setTimeout(executeAiBrainProcessing, 1500);
    } else if (state.playerHand.length === 0 && state.aiHand.length === 0) {
        setTimeout(processEndGameResult, 600);
    }
}

function processEndGameResult() {
    let message = "";
    if (state.playerScore > state.aiScore) {
        message = `🏆 VICTOIRE !\nScore final : ${state.playerScore} à ${state.aiScore}.`;
    } else if (state.aiScore > state.playerScore) {
        const botName = state.botStrategyMode === 'ilyes' ? 'Ilyes' : 'Fouad';
        message = `💀 DÉFAITE...\n${botName} l'emporte avec ${state.aiScore} points à ${state.playerScore}.`;
    } else {
        message = `🤝 MATCH NUL !\nScore parfait de ${state.playerScore} partout !`;
    }

    alert(message);
    document.getElementById('game-screen').classList.remove('active');
    document.getElementById('main-menu').classList.add('active');
}
