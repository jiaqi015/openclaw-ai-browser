import type {
  SabrinaBindingSetupState,
  SabrinaBindingTarget,
} from "../application/sabrina-openclaw";

export type BindingWizardProps = {
  state: SabrinaBindingSetupState;
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
};
