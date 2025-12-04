/**
 * WASM文件加载管理器
 * 用于在Cloudflare Pages环境中正确加载WASM文件
 */

export class WasmLoader {
  private basePath: string;

  constructor(basePath: string = '/wasm') {
    this.basePath = basePath;
  }

  /**
   * 使用WebAssembly.instantiateStreaming加载WASM文件
   */
  async loadWasm(wasmFileName: string): Promise<WebAssembly.Module> {
    const wasmUrl = `${this.basePath}/${wasmFileName}`;
    
    try {
      console.log(`[WasmLoader] 开始加载WASM文件: ${wasmUrl}`);
      
      // 确保获取WASM文件时设置正确的accept头
      const response = await fetch(wasmUrl, {
        headers: {
          'Accept': 'application/wasm'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // 验证MIME类型
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/wasm')) {
        console.warn(`[WasmLoader] 警告: MIME类型可能不正确: ${contentType}`);
      }

      // 使用WebAssembly.instantiateStreaming
      const wasmModule = await WebAssembly.instantiateStreaming(response);
      
      console.log(`[WasmLoader] ✓ WASM文件加载成功: ${wasmFileName}`);
      return wasmModule.instance;
      
    } catch (error) {
      console.error(`[WasmLoader] ✗ WASM文件加载失败: ${wasmFileName}`, error);
      throw error;
    }
  }

  /**
   * 预加载所有必需的WASM文件
   */
  async preloadWasmFiles(): Promise<void> {
    const wasmFiles = [
      'vision_wasm_internal.wasm',
      'vision_wasm_nosimd_internal.wasm'
    ];

    console.log('[WasmLoader] 开始预加载WASM文件...');
    
    try {
      await Promise.all(
        wasmFiles.map(file => this.loadWasm(file).catch(err => {
          console.warn(`[WasmLoader] 预加载失败 (${file}):`, err.message);
          return null; // 允许部分失败
        }))
      );
      
      console.log('[WasmLoader] ✓ WASM文件预加载完成');
    } catch (error) {
      console.error('[WasmLoader] ✗ WASM预加载失败:', error);
    }
  }

  /**
   * 验证WASM文件是否可访问
   */
  async validateWasmFiles(): Promise<boolean> {
    const testFiles = [
      'vision_wasm_internal.wasm',
      'vision_wasm_internal.js'
    ];

    console.log('[WasmLoader] 验证WASM文件可访问性...');
    
    for (const file of testFiles) {
      try {
        const url = `${this.basePath}/${file}`;
        const response = await fetch(url, { method: 'HEAD' });
        
        if (response.ok) {
          const contentType = response.headers.get('content-type');
          console.log(`[WasmLoader] ✅ ${file}: ${response.status} (${contentType})`);
        } else {
          console.error(`[WasmLoader] ❌ ${file}: ${response.status}`);
          return false;
        }
      } catch (error) {
        console.error(`[WasmLoader] ❌ ${file}: 网络错误`, error);
        return false;
      }
    }
    
    console.log('[WasmLoader] ✓ 所有WASM文件验证通过');
    return true;
  }
}

// 创建全局实例
export const wasmLoader = new WasmLoader();