import { useMultiplayerGame } from '@/hooks/useMultiplayerGame';
import { useVoiceChat } from '@/hooks/useVoiceChat';
import { HomeScreen } from '@/components/screens/HomeScreen';
import { LobbyScreen } from '@/components/screens/LobbyScreen';
import { GameScreen } from '@/components/screens/GameScreen';
import { Toaster } from '@/components/ui/sonner';

const Index = () => {
  const {
    roomId,
    roomCode,
    playerId,
    players,
    messages,
    gameState,
    settings,
    setSettings,
    wordOptions,
    currentPlayer,
    isHost,
    isDrawer,
    canStartGame,
    isLoading,
    isStartingGame,
    isTogglingReady,
    createRoom,
    joinRoom,
    toggleReady,
    toggleMute,
    startGame,
    selectWord,
    sendMessage,
    resetGame,
    leaveRoom
  } = useMultiplayerGame();

  const {
    isVoiceEnabled,
    isMuted: isVoiceMuted,
    isConnecting,
    speakingPeers,
    enableVoice,
    disableVoice,
    toggleMute: toggleVoiceMute
  } = useVoiceChat(roomId, playerId);

  // Not in a room - show home screen
  if (!roomCode || !playerId) {
    return (
      <>
        <HomeScreen
          onCreateRoom={(name, avatar, isPublic) => {
            setSettings({ ...settings, isPublic });
            createRoom(name, avatar);
          }}
          onJoinRoom={joinRoom}
        />
        <Toaster position="top-center" />
      </>
    );
  }

  // In lobby - show lobby screen
  if (gameState.phase === 'lobby') {
    return (
      <>
        <LobbyScreen
          roomCode={roomCode}
          players={players}
          messages={messages}
          settings={settings}
          currentPlayer={currentPlayer}
          isHost={isHost}
          canStartGame={canStartGame}
          isLoading={isLoading}
          isStartingGame={isStartingGame}
          isTogglingReady={isTogglingReady}
          onSettingsChange={setSettings}
          onToggleReady={toggleReady}
          onStartGame={startGame}
          onSendMessage={sendMessage}
          onLeave={leaveRoom}
        />
        <Toaster position="top-center" />
      </>
    );
  }

  // In game - show game screen
  return (
    <>
      <GameScreen
        roomId={roomId!}
        gameState={gameState}
        players={players}
        messages={messages}
        currentPlayer={currentPlayer}
        isDrawer={isDrawer}
        wordOptions={wordOptions}
        isVoiceEnabled={isVoiceEnabled}
        isMuted={isVoiceMuted}
        isConnecting={isConnecting}
        speakingPeers={speakingPeers}
        onSelectWord={selectWord}
        onSendMessage={sendMessage}
        onEnableVoice={enableVoice}
        onDisableVoice={disableVoice}
        onToggleMute={toggleVoiceMute}
        onLeave={leaveRoom}
        onPlayAgain={resetGame}
      />
      <Toaster position="top-center" />
    </>
  );
};

export default Index;
