import { PrivacyNotice } from '../../cases/components/PrivacyNotice';

export type MediatorDemoNoticeProps = {
  title: string;
  body: string;
};

/** The "simulated request/assignment, no real professional contacted" disclaimer. Thin wrapper over PrivacyNotice, like NoticesDemoNotice. */
export function MediatorDemoNotice({ title, body }: MediatorDemoNoticeProps) {
  return (
    <PrivacyNotice icon="info" title={title}>
      {body}
    </PrivacyNotice>
  );
}
