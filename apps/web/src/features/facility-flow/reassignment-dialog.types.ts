export interface UnitAssignmentConfirmation {
  bookingId: string;
  bookingCode: string;
  customerName: string;
  previousUnitCode: string | null;
  physicalUnitId: string;
  unitCode: string;
  reason: string;
}

export interface ReassignmentDialogProps {
  change: UnitAssignmentConfirmation;
  pending: boolean;
  error: string;
  onCancel: () => void;
  onConfirm: () => void;
}
