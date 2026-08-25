import { PluginListenerHandle } from "@capacitor/core";
export interface CapacitorKakaoLoginPlugin {
    echo(options: {
        value: string;
    }): Promise<{
        value: string;
    }>;
    initSDK(): Promise<void>;
    prompt(options?: PromptOptions): Promise<void>;
    addListener(eventName: 'callback', listenerFunc: (data: CallbackData) => void): Promise<PluginListenerHandle> & PluginListenerHandle;
}
export interface PromptOptions {
    extra?: any;
    scopes?: string[];
}
export interface CallbackData {
    success: boolean;
    error?: string;
    access_token?: string;
    expires_in?: string;
    refresh_token?: string;
    refresh_token_expires_in?: string;
    refresh_token_expired_at?: string;
    id_token?: string;
    token_type?: string;
}
