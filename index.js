import axios from "axios";

const defaultConfig = {
  method: "GET",
  cancelDuplicated: false, 
  duplicatedKey: "", 
  retry: 0,
  retryDelay: 200,
  retryDelayRise: true,
  timeout: -1,
  cache: false
};

const ERROR_TYPE = {
  Cancel: "cancelDuplicated",
};

const isFunction = (p) => typeof p === "function";

class MAxios {
  constructor() {
    this.__name = "MAxios";
    this.requestMap = new Map();
    this.responseCacheMap = new Map();
  }

  /**
   * 生成标识请求的唯一key
   */
  getDuplicatedKey(config) {
    const { duplicatedKey, url, method } = config;
    let customKey = "";
    if (duplicatedKey && isFunction(duplicatedKey)) {
      customKey = duplicatedKey(config);
    }
    return customKey || `${method.toLocaleLowerCase()}${url}`;
  }
  /**
   * 添加请求
   */
  addReq(config) {
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
  removeReq(config) {
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
        message: "Request canceled ",
      });
    } catch (error) {
      console.log("removeReq: ", error);
    }
  }

  /**
   * 重试某次请求
   */
  retry({ instance, config, error }) {
    const { retry, retryDelay, retryDelayRise } = config;
    let retryCount = config.__retryCount || 0;
    config.__retryCount = retryCount;
    // 检查是否超过重置次数
    if (retryCount >= retry) {
      return Promise.reject(error);
    }
    // 重发计数器加1
    retryCount += 1;
    config.__retryCount = retryCount;

    if (retryCount === retry) {
      config.timeout = 15000;
    }
    // 延时重发
    const delay = isFunction(retryDelay)
      ? retryDelay(retryCount)
      : retryDelay * (retryDelayRise ? retryCount : 1);
      
    const retryTask = new Promise((resolve) => {
      setTimeout(() => {
        resolve();
      }, delay);
    });
    return retryTask.then(() => {
      console.log("开始retry: ", config.__retryCount);
      return instance.request(config);
    });
  }
  /**
   * 获取response缓存
   * @param {*} config 
   */
  getResponseCache(config) {
    const key = this.getDuplicatedKey(config);
    if(this.responseCacheMap.has(key)) {
      return this.responseCacheMap.get(key)
    }
    return null;
  }
  /**
   * 设置response缓存
   * @param {*} config 
   * @param {*} response 
   */
  setResponseCache(config, response) {
    if(!config.cache) {
      return;
    }
    const key = this.getDuplicatedKey(config);
    this.responseCacheMap.set(key, response);
  }

  /**
   * 实例工厂函数
   */
  getAxiosInstance(config) {
    const instance = axios.create();
    return instance;
  }
  /**
   * 请求拦截器
   * @param {*} instance
   */
  interceptorsRequest(instance) {
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
  interceptorsResponse(instance) {
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
          // Do something with response error outside status code 2xx

          // retry 重试逻辑
          if (config.retry > 0) {
            return this.retry({ instance, config, error });
          }
          return Promise.reject(error);
        }
      }
    );
  }

  interceptors(instance) {
    this.interceptorsRequest(instance);
    this.interceptorsResponse(instance);
  }

  /**
   * public request 对外接口
   * @param {*} config 当前请求的配置参数
   */
  request(options) {
    const config = Object.assign({}, defaultConfig, options);


    if(config.cache) {
      const responseCache = this.getResponseCache(config);
      if (responseCache) {
        console.log('数据来自缓存: ')
        return Promise.resolve(responseCache)
      }
    }

    const instance = this.getAxiosInstance();
    this.interceptors(instance);
    return instance.request(config);
  }
}

export default new MAxios();
