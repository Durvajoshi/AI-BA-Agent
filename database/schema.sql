CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  jira_base_url VARCHAR(255),
  jira_email VARCHAR(255),
  jira_api_token VARCHAR(255),
  jira_lead_account_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE conversations (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  title VARCHAR(255),
  preview TEXT,
  clarification_done BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE messages (
  id UUID PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id),
  sender VARCHAR(10) CHECK (sender IN ('user', 'ai')),
  content TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE ba_documents (
  id UUID PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id),
  title TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE ba_versions (
  id UUID PRIMARY KEY,
  ba_document_id UUID REFERENCES ba_documents(id),
  version_number INT,
  ba_output JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE activity_diagrams (
  id UUID PRIMARY KEY,
  ba_version_id UUID REFERENCES ba_versions(id),
  diagram_definition TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE jira_issues (
  id UUID PRIMARY KEY,
  ba_version_id UUID REFERENCES ba_versions(id),
  user_story_id TEXT,
  jira_issue_key TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
