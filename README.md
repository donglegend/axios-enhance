## axios-enhance
对axios进行封装，支持以下功能：
1. 缓存请求数据；对实时数据要求不高的接口直接返回上一次的结果
2. 支持自动取消重复请求；避免频繁操作副作用
3. 支持失败自动重试

javascript版本
index.js


typescript版本
index.ts

## 使用方式
对外导出单一实例（单例模式），统一管理网站请求

### 参数说明
支持axios官方的一切参数。除此之外的自定义参数如下：

|  属性   | 说明  | 类型 | 默认值 |
|  ----  | ----  | ----  |  ----  | 
| cache  | 是否启动缓存能力 | boolean | false |
| cancelDuplicated  | 是否取消重复请求 | boolean | true |
| duplicatedKey  | 对请求设置唯一key | Function | null |
| retry  | 重试次数 | number | 0 |
| retryDelay  | 重试延迟，单位ms | number | 200 |
| retryDelayRise  | 是否启动延迟递增 | boolean | true |


### demo
```js
import fetch from "./index";

for (let index = 0; index < 10; index++) {
  fetch
    .request({
      url: "https://api.github.com/users/donglegend",
      cache: true,
      cancelDuplicated: true,
      retry: 3,
      retryDelay: 200,
    })
    .then((res) => {
      console.log(res);
    })
    .catch((err) => {
      console.log("error", err);
    })
    .finally(() => {});
}
```
