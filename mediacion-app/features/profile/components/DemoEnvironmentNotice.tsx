import { PrivacyNotice } from '../../cases/components/PrivacyNotice';

export type DemoEnvironmentNoticeProps = {
  title: string;
  body: string;
};

/**
 * The "this is a demonstration, nothing real happens yet" disclaimer for
 * profile/account/notification screens. Thin wrapper over the existing
 * PrivacyNotice visual treatment, mirroring SignatureEnvironmentNotice,
 * rather than introducing a new banner style.
 */
export function DemoEnvironmentNotice({ title, body }: DemoEnvironmentNoticeProps) {
  return (
    <PrivacyNotice icon="info" title={title}>
      {body}
    </PrivacyNotice>
  );
}
