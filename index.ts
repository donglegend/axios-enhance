import axios, { AxiosRequestConfig, Method, AxiosInstance, AxiosResponse, AxiosError } from 'axios';

type IRetryDelay = number | ((c: number) => number);

interface IConfig extends AxiosRequestConfig {
  cancelDuplicated?: boolean;
  duplicatedKey?: (ops: IConfig) => string;
  retry?: number;
  retryDelay?: IRetryDelay;
  retryDelayRise?: boolean;
  cache?: boolean;
  __retryCount?: number;
}

const defaultConfig: IConfig = {
  method: 'get',
  cancelDuplicated: false,
  duplicatedKey: ({ method, url }) => `${(method as Method).toLocaleLowerCase()}${url}`,
  retry: 0,
  retryDelay: 200,
  retryDelayRise: true,
  cache: false
};

const ERROR_TYPE = {
  Cancel: 'cancelDuplicated'
};

class MAxios {
  public name: string = 'MAxios';
  private requestMap = new Map();
  private responseCacheMap = new Map();

  /**
   * 生成标识请求的唯一key
   */
  private getDuplicatedKey(config: IConfig) {
    const { duplicatedKey = () => '' } = config;
    return duplicatedKey(config);
  }
  /**
   * 添加请求
   */
  private addReq(config: IConfig) {
    const { cancelDuplicated } = config;
    if (!cancelDuplicated) {
      return;
    }
    const key = this.getDuplicatedKey(config);
    if (!this.requestMap.has(key)) {
      config.cancelToken = new axios.CancelToken((c) => {
        this.requestMap.set(key, c);
      });
    }
  }
  /**
   * 移除请求
   */
  private removeReq(config: IConfig) {
    try {
      const { cancelDuplicated } = config;
      const key = this.getDuplicatedKey(config);
      if (!cancelDuplicated) {
        return;
      }
      if (!this.requestMap.has(key)) {
        return;
      }
      const cancel = this.requestMap.get(key);
      this.requestMap.delete(key);
      cancel({
        type: ERROR_TYPE.Cancel,
        message: 'Request canceled '
      });
    } catch (error) {
      console.log('removeReq: ', error);
    }
  }

  /**
   * 重试某次请求
   */
  private retry({
    instance,
    config,
    error
  }: {
    instance: AxiosInstance;
    config: IConfig;
    error: AxiosError;
  }) {
    const { retry, retryDelay, retryDelayRise } = config;
    let retryCount = config.__retryCount || 0;
    config.__retryCount = retryCount;
    // 检查是否超过重置次数
    if (retryCount >= retry!) {
      return Promise.reject(error);
    }
    // 重发计数器加1
    retryCount += 1;
    config.__retryCount = retryCount;

    // 延时重发
    let delay = 0;
    if (typeof retryDelay === 'number') {
      delay = retryDelay * (retryDelayRise ? retryCount : 1);
    } else {
      delay = retryDelay!(retryCount);
    }

    const retryTask = new Promise<void>((resolve) => {
      setTimeout(() => {
        resolve();
      }, delay);
    });
    return retryTask.then(() => {
      return instance.request(config);
    });
  }
  /**
   * 获取response缓存
   * @param {*} config
   */
  private getResponseCache(config: IConfig) {
    const key = this.getDuplicatedKey(config);
    if (this.responseCacheMap.has(key)) {
      return this.responseCacheMap.get(key);
    }
    return null;
  }
  /**
   * 设置response缓存
   * @param {*} config
   * @param {*} response
   */
  private setResponseCache(config: IConfig, response: AxiosResponse) {
    if (!config.cache) {
      return;
    }
    const key = this.getDuplicatedKey(config);
    this.responseCacheMap.set(key, response);
  }

  /**
   * 实例工厂函数
   */
  private getAxiosInstance(config: IConfig) {
    const instance = axios.create();
    return instance;
  }
  /**
   * 请求拦截器
   * @param {*} instance
   */
  private interceptorsRequest(instance: AxiosInstance) {
    instance.interceptors.request.use(
      (config) => {
        // Do something before request is sent
        this.removeReq(config);
        this.addReq(config);
        return config;
      },
      (error) => {
        // Do something with request error
        return Promise.reject(error);
      }
    );
  }
  /**
   * 响应拦截器
   * @param {*} instance
   */
  private interceptorsResponse(instance: AxiosInstance) {
    instance.interceptors.response.use(
      (response) => {
        // Do something with response data with status code 2xx
        this.removeReq(response.config);
        this.setResponseCache(response.config, response);
        return response;
      },
      (error) => {
        const config = error.config || {};
        this.removeReq(config);

        if (axios.isCancel(error)) {
          return Promise.reject(error.message);
        } else {
          // retry 重试逻辑
          if (config.retry > 0) {
            return this.retry({ instance, config, error });
          }
          return Promise.reject(error);
        }
      }
    );
  }

  private interceptors(instance: AxiosInstance) {
    this.interceptorsRequest(instance);
    this.interceptorsResponse(instance);
  }

  /**
   * public request 对外接口
   * @param {*} config 当前请求的配置参数
   */
  public request(options: IConfig) {
    const config = Object.assign({}, defaultConfig, options);

    if (config.cache) {
      const responseCache = this.getResponseCache(config);
      if (responseCache) {
        return Promise.resolve(responseCache);
      }
    }

    const instance = this.getAxiosInstance(config);
    this.interceptors(instance);
    return instance.request(config);
  }
}
// 单例模式 的 导出
export default new MAxios();
