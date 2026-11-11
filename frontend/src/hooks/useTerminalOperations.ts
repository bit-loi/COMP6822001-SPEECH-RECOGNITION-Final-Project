import { TerminalTab } from '@/types/editor';

interface UseTerminalOperationsProps {
  terminals: TerminalTab[];
  setTerminals: (terminals: TerminalTab[]) => void;
  activeTerminal: string;
  setActiveTerminal: (id: string) => void;
}

export const useTerminalOperations = ({
  terminals,
  setTerminals,
  activeTerminal,
  setActiveTerminal,
}: UseTerminalOperationsProps) => {
  const handleNewTerminal = () => {
    const newId = (terminals.length + 1).toString();
    const newTerminal: TerminalTab = {
      id: newId,
      name: `bash ${newId}`,
    };
    setTerminals([...terminals, newTerminal]);
    setActiveTerminal(newId);
  };

  const handleCloseTerminal = (id: string) => {
    if (terminals.length === 1) return;

    const updatedTerminals = terminals.filter(t => t.id !== id);
    setTerminals(updatedTerminals);

    if (activeTerminal === id) {
      setActiveTerminal(updatedTerminals[0].id);
    }
  };

  const handleTerminalCommand = (sessionId: string, cmd: string) => {
    console.log(`Terminal ${sessionId} command:`, cmd);
  };

  return {
    handleNewTerminal,
    handleCloseTerminal,
    handleTerminalCommand,
  };
};
