export type ErrorCode =
  | 'PROVIDER_NOT_CONFIGURED' | 'PROVIDER_UNAVAILABLE' | 'MODEL_NOT_FOUND'
  | 'MODEL_CAPABILITY_UNSUPPORTED' | 'RATE_LIMITED' | 'QUOTA_EXHAUSTED'
  | 'REQUEST_TOO_LARGE' | 'CONTEXT_EXCEEDED' | 'UNSUPPORTED_FILE' | 'FILE_TOO_LARGE'
  | 'INVALID_REQUEST' | 'NETWORK_ERROR' | 'LOCAL_ENDPOINT_BLOCKED' | 'REQUEST_TIMEOUT'
  | 'CANCELLED' | 'STORAGE_UNAVAILABLE' | 'STORAGE_QUOTA_EXCEEDED' | 'CONSENT_REQUIRED'
  | 'INVALID_IMPORT' | 'UNKNOWN_SAFE_ERROR';

export type DataSent = 'no' | 'yes' | 'unknown';

export interface UserFacingError {
  code: ErrorCode;
  /** What happened, in plain language. */
  message: string;
  /** Whether the user's draft/prompt was kept. */
  promptKept: boolean;
  dataSent: DataSent;
  /** What the user can do next. */
  nextStep: string;
  retrySafe: boolean;
}

type Entry = Omit<UserFacingError, 'code'>;

const T: Record<ErrorCode, Entry> = {
  PROVIDER_NOT_CONFIGURED: { message: 'No AI model is set up yet.', promptKept: true, dataSent: 'no', nextStep: 'Set up a local model in Settings.', retrySafe: true },
  PROVIDER_UNAVAILABLE: { message: "Aurora can't reach the model.", promptKept: true, dataSent: 'no', nextStep: 'Check that your local runtime is running, then retry.', retrySafe: true },
  MODEL_NOT_FOUND: { message: 'The selected model was not found.', promptKept: true, dataSent: 'no', nextStep: 'Choose another model in Settings.', retrySafe: true },
  MODEL_CAPABILITY_UNSUPPORTED: { message: 'This model does not support that feature.', promptKept: true, dataSent: 'no', nextStep: 'Choose a different model or remove the unsupported input.', retrySafe: true },
  RATE_LIMITED: { message: 'The online service is busy.', promptKept: true, dataSent: 'unknown', nextStep: 'Try again shortly, or switch to your local model.', retrySafe: true },
  QUOTA_EXHAUSTED: { message: 'The free online allowance appears to be used up for now.', promptKept: true, dataSent: 'unknown', nextStep: 'Use your local model or try again later. No charges were made.', retrySafe: true },
  REQUEST_TOO_LARGE: { message: 'That message is too long to send.', promptKept: true, dataSent: 'no', nextStep: 'Shorten the message and try again.', retrySafe: false },
  CONTEXT_EXCEEDED: { message: "That message does not fit in the model's context.", promptKept: true, dataSent: 'no', nextStep: 'Shorten it or start a new chat.', retrySafe: false },
  UNSUPPORTED_FILE: { message: 'That file type is not supported.', promptKept: true, dataSent: 'no', nextStep: 'Use a supported file type.', retrySafe: false },
  FILE_TOO_LARGE: { message: 'That file is too large.', promptKept: true, dataSent: 'no', nextStep: 'Use a smaller file.', retrySafe: false },
  INVALID_REQUEST: { message: 'The request was not valid.', promptKept: true, dataSent: 'no', nextStep: 'Edit your message and try again.', retrySafe: false },
  NETWORK_ERROR: { message: 'A network problem interrupted the request.', promptKept: true, dataSent: 'unknown', nextStep: 'Check your connection and retry.', retrySafe: true },
  LOCAL_ENDPOINT_BLOCKED: { message: 'Your browser blocked the connection to the local model.', promptKept: true, dataSent: 'no', nextStep: 'See the setup guide in Help.', retrySafe: true },
  REQUEST_TIMEOUT: { message: 'The model took too long to respond.', promptKept: true, dataSent: 'unknown', nextStep: 'Retry, or try a smaller model.', retrySafe: true },
  CANCELLED: { message: 'Generation stopped.', promptKept: true, dataSent: 'unknown', nextStep: 'You can retry whenever you like.', retrySafe: true },
  STORAGE_UNAVAILABLE: { message: "Your browser isn't allowing Aurora to save history.", promptKept: true, dataSent: 'no', nextStep: 'You can keep chatting, but history will not be saved. Check browser privacy settings.', retrySafe: true },
  STORAGE_QUOTA_EXCEEDED: { message: 'Browser storage is full.', promptKept: true, dataSent: 'no', nextStep: 'Export and delete old conversations to free space.', retrySafe: true },
  CONSENT_REQUIRED: { message: 'This would send your message to an online provider.', promptKept: true, dataSent: 'no', nextStep: 'Review the details and choose to continue or stay on-device.', retrySafe: true },
  INVALID_IMPORT: { message: 'That file could not be imported.', promptKept: true, dataSent: 'no', nextStep: 'Choose a valid Aurora export file.', retrySafe: false },
  UNKNOWN_SAFE_ERROR: { message: 'Something went wrong.', promptKept: true, dataSent: 'unknown', nextStep: 'Try again. If it keeps happening, see Help.', retrySafe: true },
};

export function toUserFacingError(code: ErrorCode): UserFacingError {
  return { code, ...T[code] };
}
export const ALL_ERROR_CODES = Object.keys(T) as ErrorCode[];
