/**
 * dsh-nav-fold · 宿主半
 *
 * 本插件没有任何 Host 侧行为：折叠完全发生在浏览器端。
 * 这个入口存在的意义只有一个——让包能被 cordis 挂载，从而让
 * dsh-client-modules 的 dsh.client 扫描收录我们的浏览器半。
 */
export const name = "nav-fold";

/** 挂载即完成，不注册任何 Host 服务、不写任何文件。 */
export function apply() {}
