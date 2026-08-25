import { PluginListenerHandle, WebPlugin } from '@capacitor/core';
import type { CapacitorKakaoLoginPlugin, PromptOptions } from './definitions';
export declare class CapacitorKakaoLoginWeb extends WebPlugin implements CapacitorKakaoLoginPlugin {
    echo(options: {
        value: string;
    }): Promise<{
        value: string;
    }>;
    initSDK(): Promise<void>;
    prompt(options?: PromptOptions): Promise<void>;
    addListener(eventName: 'callback', listenerFunc: (data: any) => void): Promise<PluginListenerHandle> & PluginListenerHandle & any;
}
