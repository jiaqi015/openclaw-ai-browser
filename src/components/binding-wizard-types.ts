import type {
  SabrinaBindingSetupState,
  SabrinaBindingTarget,
} from "../application/sabrina-openclaw";

export type BindingWizardProps = {
  state: SabrinaBindingSetupState;
  connectionConfig?: SabrinaOpenClawConnectionConfig;
  connectionState?: SabrinaOpenClawConnectionState | null;
  gatewayStatus?: SabrinaOpenClawGatewayStatus | null;
  deviceStatus?: SabrinaOpenClawDeviceStatus | null;
  pairingStatus?: SabrinaOpenClawPairingStatus | null;
  lastError?: string;
  approvingPairingRequestId?: string | null;
  isApprovingLatestDevice?: boolean;
  onSelectTarget?: (target: SabrinaBindingTarget) => void;
  onPrimaryAction?: () => void;
  onSecondaryAction?: () => void;
  onApprovePairingRequest?: (
    request: SabrinaOpenClawPairingStatus["requests"][number],
  ) => void;
  onApproveLatestDeviceRequest?: () => void;
  onConnectRemote?: (params?: {
    target?: "local" | "remote";
    profile?: string;
    stateDir?: string;
    driver?: "local-cli" | "ssh-cli" | "relay-paired" | "endpoint";
    sshTarget?: string;
    sshPort?: number;
    endpointUrl?: string;
    accessToken?: string;
    relayUrl?: string;
    connectCode?: string;
    label?: string;
    agentId?: string;
  }) => void;
  onDoctorRemote?: (params?: {
    target?: "local" | "remote";
    profile?: string;
    stateDir?: string;
    driver?: "local-cli" | "ssh-cli" | "relay-paired" | "endpoint";
    sshTarget?: string;
    sshPort?: number;
    endpointUrl?: string;
    accessToken?: string;
    relayUrl?: string;
    connectCode?: string;
    label?: string;
    agentId?: string;
  }) => void;
  onProbeRemote?: (params?: {
    target?: "local" | "remote";
    profile?: string;
    stateDir?: string;
    driver?: "local-cli" | "ssh-cli" | "relay-paired" | "endpoint";
    sshTarget?: string;
    sshPort?: number;
    endpointUrl?: string;
    accessToken?: string;
    relayUrl?: string;
    connectCode?: string;
    label?: string;
    agentId?: string;
  }) => Promise<SabrinaOpenClawConnectionProbeResult | null> | SabrinaOpenClawConnectionProbeResult | null;
  onSaveRemote?: (params?: {
    id?: string;
    name?: string;
    target?: "local" | "remote";
    profile?: string;
    stateDir?: string;
    driver?: "local-cli" | "ssh-cli" | "relay-paired" | "endpoint";
    sshTarget?: string;
    sshPort?: number;
    endpointUrl?: string;
    accessToken?: string;
    relayUrl?: string;
    connectCode?: string;
    label?: string;
    agentId?: string;
    markActive?: boolean;
  }) => Promise<SabrinaOpenClawState | null> | SabrinaOpenClawState | null;
  onCreateRelayConnectCode?: (params?: {
    relayUrl?: string;
    ttlMs?: number;
  }) => Promise<SabrinaOpenClawRelayPairingState | null> | SabrinaOpenClawRelayPairingState | null;
  onGetRelayPairingState?: (params?: {
    relayUrl?: string;
    connectCode?: string;
  }) => Promise<SabrinaOpenClawRelayPairingState | null> | SabrinaOpenClawRelayPairingState | null;
  connectionProbe?: SabrinaOpenClawConnectionProbeResult | null;
};
