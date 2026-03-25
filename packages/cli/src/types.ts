export interface Credentials {
  api_url: string;
  access_token?: string;
  refresh_token?: string;
  workspace_id?: string;
  email?: string;
  name?: string;
}

export interface ProjectConfig {
  product: string;
  feature?: string;
}
