import { PrivacyNotice } from '../../cases/components/PrivacyNotice';

export type NoticesDemoNoticeProps = {
  title: string;
  body: string;
};

/** The "this demo doesn't send real emails/push" disclaimer. Thin wrapper over the existing PrivacyNotice, like DemoEnvironmentNotice/SignatureEnvironmentNotice. */
export function NoticesDemoNotice({ title, body }: NoticesDemoNoticeProps) {
  return (
    <PrivacyNotice icon="info" title={title}>
      {body}
    </PrivacyNotice>
  );
}
