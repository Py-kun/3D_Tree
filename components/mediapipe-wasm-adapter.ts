/**
 * MediaPipe WASM 加载适配器
 * 解决Cloudflare Pages环境下的WASM加载问题
 */

export class MediaPipeWasmAdapter {
  private wasmPath: string;

  constructor(wasmPath: string = '/wasm') {
    this.wasmPath = wasmPath;
  }

  /**
   * 为MediaPipe创建自定义的WASM加载器
   */
  createWasmLoader() {
    return {
      locateFile: (path: string, prefix: string) => {
        console.log(`[MediaPipeWasmAdapter] 定位文件: ${path}, 前缀: ${prefix}`);
        
        // 确保WASM文件使用正确的路径
        if (path.endsWith('.wasm')) {
          const fullPath = `${this.wasmPath}/${path}`;
          console.log(`[MediaPipeWasmAdapter] WASM文件路径: ${fullPath}`);
          return fullPath;
        }
        
        // JS文件使用默认路径
        return prefix + path;
      },
      
      // 自定义WASM实例化
      instantiateWasm: async (imports: any, successCallback: Function) => {
        console.log('[MediaPipeWasmAdapter] 自定义WASM实例化');
        
        try {
          const wasmFileName = 'vision_wasm_internal.wasm';
          const wasmUrl = `${this.wasmPath}/${wasmFileName}`;
          
          console.log(`[MediaPipeWasmAdapter] 加载WASM: ${wasmUrl}`);
          
          // 使用WebAssembly.instantiateStreaming
          const response = await fetch(wasmUrl);
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          
          const contentType = response.headers.get('content-type');
          if (!contentType || !contentType.includes('application/wasm')) {
            console.warn(`[MediaPipeWasmAdapter] 警告: WASM MIME类型可能不正确: ${contentType}`);
          }
          
          const wasmModule = await WebAssembly.instantiateStreaming(response, imports);
          successCallback(wasmModule.instance, wasmModule.module);
          
          console.log('[MediaPipeWasmAdapter] ✓ WASM实例化成功');
          return wasmModule.instance;
          
        } catch (error) {
          console.error('[MediaPipeWasmAdapter] ✗ WASM实例化失败:', error);
          throw error;
        }
      }
    };
  }

  /**
   * 获取FilesetResolver的配置选项
   */
  getFilesetResolverOptions() {
    const wasmLoader = this.createWasmLoader();
    
    return {
      wasmLoaderPath: this.wasmPath,
      // 传递自定义的locateFile函数
      locateFile: wasmLoader.locateFile,
      // 注意：FilesetResolver可能不支持instantiateWasm，需要在更高层面处理
    };
  }
}

// 创建全局适配器实例
export const mediaPipeWasmAdapter = new MediaPipeWasmAdapter();