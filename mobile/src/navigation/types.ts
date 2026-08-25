export type RootStackParamList = {
  Main: undefined;
  EmailDetail: { emailId: string };
  ComposeReply: { emailId: string; subject: string };
  ContactDetail: { contactEmail: string; contactName: string };
  Revenue: undefined;
  Relationships: undefined;
  Quotes: undefined;
  Sequences: undefined;
  Briefs: undefined;
  Knowledge: undefined;
  Settings: undefined;
  Billing: undefined;
  SLA: undefined;
  Workspace: undefined;
  Notifications: undefined;
};

export type TabParamList = {
  Dashboard: undefined;
  Inbox: undefined;
  Actions: undefined;
  More: undefined;
};
