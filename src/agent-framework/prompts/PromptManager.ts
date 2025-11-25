import { AgentType } from '../core/types';
import { PLANNER_CORE_TEMPLATE, EXECUTOR_CORE_TEMPLATE, VERIFIER_CORE_TEMPLATE } from './templates';

/**
 * PromptManager - 提示词管理器
 * 
 * 负责管理和组合 Agent 的提示词：
 * 1. 框架层级的核心提示词（templates.ts）- 确保框架工作
 * 2. 业务层级的上下文（通过 setBusinessContext 设置）- 业务相关的系统提示词
 * 
 * 最终的 system message = 核心模板 + 业务上下文
 */
export class PromptManager {
  private coreTemplates: Map<AgentType, string> = new Map();
  private businessContexts: Map<AgentType, string> = new Map();
  private defaultBusinessContext: string = '';

  constructor() {
    // 加载框架核心模板
    this.coreTemplates.set('planner', PLANNER_CORE_TEMPLATE);
    this.coreTemplates.set('executor', EXECUTOR_CORE_TEMPLATE);
    this.coreTemplates.set('verifier', VERIFIER_CORE_TEMPLATE);
  }

  /**
   * 设置默认的业务上下文（适用于所有 Agent）
   * @deprecated 推荐使用 setBusinessContext 为每个 Agent 单独设置
   */
  setSystemContext(context: string) {
    this.defaultBusinessContext = context;
  }

  /**
   * 为特定 Agent 设置业务上下文
   * @param type Agent 类型
   * @param context 业务上下文内容
   */
  setBusinessContext(type: AgentType, context: string) {
    this.businessContexts.set(type, context);
  }

  /**
   * 批量设置所有 Agent 的业务上下文
   * @param contexts 业务上下文映射
   */
  setAllBusinessContexts(contexts: Record<AgentType, string>) {
    Object.entries(contexts).forEach(([type, context]) => {
      this.businessContexts.set(type as AgentType, context);
    });
  }

  /**
   * 覆盖框架核心模板（高级用法）
   * @param type Agent 类型
   * @param template 新的核心模板
   */
  setCoreTemplate(type: AgentType, template: string) {
    this.coreTemplates.set(type, template);
  }

  /**
   * @deprecated 使用 setCoreTemplate 替代
   */
  setTemplate(type: AgentType, template: string) {
    this.setCoreTemplate(type, template);
  }

  /**
   * 获取处理后的完整提示词
   * 将核心模板与业务上下文合并
   * @param type Agent 类型
   * @returns 完整的 system message
   */
  getPrompt(type: AgentType): string {
    const coreTemplate = this.coreTemplates.get(type);
    if (!coreTemplate) {
      throw new Error(`No core template found for agent type: ${type}`);
    }

    // 获取业务上下文：优先使用特定 Agent 的上下文，否则使用默认上下文
    const businessContext = this.businessContexts.get(type) || this.defaultBusinessContext;

    return this.processTemplate(coreTemplate, businessContext);
  }

  /**
   * 获取原始的核心模板（不含业务上下文）
   * @param type Agent 类型
   * @returns 核心模板
   */
  getCoreTemplate(type: AgentType): string | undefined {
    return this.coreTemplates.get(type);
  }

  /**
   * 获取业务上下文
   * @param type Agent 类型
   * @returns 业务上下文
   */
  getBusinessContext(type: AgentType): string {
    return this.businessContexts.get(type) || this.defaultBusinessContext;
  }

  private processTemplate(template: string, businessContext: string): string {
    // 替换 {{businessContext}} 占位符
    let result = template.replace(/{{businessContext}}/g, businessContext);
    
    // 向后兼容：也替换旧的 {{systemContext}} 占位符
    result = result.replace(/{{systemContext}}/g, businessContext);
    
    return result;
  }
}
