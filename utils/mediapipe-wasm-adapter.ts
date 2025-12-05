// src/utils/mediapipe-wasm-adapter.ts

/**
 * MediaPipe WASM 加载器适配器
 *
 * 目的：
 * 1. 拦截 MediaPipe 的 WASM 文件请求。
 * 2. 使用自定义的 `instantiateWasm` 方法替换默认的加载行为。
 *
 * 背景：
 * - Cloudflare Pages/Workers 对 WASM 的加载有严格的 MIME 类型要求。
 * - MediaPipe 默认的加载方式（通过 <script> 标签）在这些环境下会失败。
 * - 此适配器确保使用 `WebAssembly.instantiateStreaming` 加载 WASM，以满足平台要求。
 */
class MediaPipeWasmAdapter {
  private wasmPath: string;

  constructor(wasmPath: string = '/wasm') {
    this.wasmPath = wasmPath;
  }

  /**
   * 创建并返回一个兼容 MediaPipe 的 WASM 加载器配置对象。
   * @returns {{ locateFile: Function, instantiateWasm: Function }}
   */
  public createWasmConfig() {
    return {
      /**
       * 定位 WASM 和其他相关文件。
       * @param {string} path - 文件名 (e.g., "vision_wasm_internal.wasm")
       * @param {string} prefix - 文件路径前缀
       * @returns {string} - 文件的完整路径
       */
      locateFile: (path: string, prefix: string): string => {
        // 如果是 .wasm 文件，强制指向我们自定义的路径
        if (path.endsWith('.wasm')) {
          const wasmUrl = `${this.wasmPath}/${path}`;
          console.log(`[MediaPipeWasmAdapter] 定位 WASM 文件: ${wasmUrl}`);
          return wasmUrl;
        }
        // 其他文件保持默认行为
        return prefix + path;
      },

      /**
       * 自定义 WASM 实例化方法。
       * @param {any} imports - WASM 模块的导入对象
       * @param {(instance: WebAssembly.Instance, module: WebAssembly.Module) => void} successCallback - 成功回调
       * @returns {Promise<WebAssembly.Instance>} - WASM 实例
       */
      instantiateWasm: async (
        imports: any,
        successCallback: (instance: WebAssembly.Instance, module: WebAssembly.Module) => void
      ): Promise<WebAssembly.Instance> => {
        console.log('[MediaPipeWasmAdapter] 自定义 instantiateWasm 已被调用');
        const wasmUrl = `${this.wasmPath}/vision_wasm_internal.wasm`;

        try {
          // 优先使用流式实例化，性能更好
          const response = await fetch(wasmUrl, {
            headers: { 'Accept': 'application/wasm' }
          });
          const wasmModule = await WebAssembly.instantiateStreaming(response, imports);
          successCallback(wasmModule.instance, wasmModule.module);
          console.log('[MediaPipeWasmAdapter] ✓ WASM 流式实例化成功');
          return wasmModule.instance;
        } catch (error) {
          console.error('[MediaPipeWasmAdapter] ✗ WASM 流式实例化失败:', error);

          // 流式实例化失败后的回退方案
          try {
            console.log('[MediaPipeWasmAdapter] 尝试 ArrayBuffer 回退方案...');
            const response = await fetch(wasmUrl);
            const wasmBuffer = await response.arrayBuffer();
            const wasmModule = await WebAssembly.instantiate(wasmBuffer, imports);
            successCallback(wasmModule.instance, wasmModule.module);
            console.log('[MediaPipeWasmAdapter] ✓ ArrayBuffer 回退方案成功');
            return wasmModule.instance;
          } catch (fallbackError) {
            console.error('[MediaPipeWasmAdapter] ✗ ArrayBuffer 回退方案也失败:', fallbackError);
            throw fallbackError; // 抛出最终错误
          }
        }
      }
    };
  }
}

// 导出单例
export const mediaPipeWasmAdapter = new MediaPipeWasmAdapter();
