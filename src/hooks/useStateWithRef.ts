import { useState, useRef, useCallback, useLayoutEffect } from 'react'

/**
 * 一个同时管理 state 和 ref 的 hook，用于解决异步回调中的闭包问题
 * 
 * 这个 hook 确保 state 和 ref 始终保持同步，让你可以在异步回调中通过 ref
 * 获取最新的状态值，而不会遇到闭包陷阱。
 * 
 * @example
 * ```tsx
 * const [messages, setMessages, messagesRef] = useStateWithRef<Message[]>([])
 * 
 * // 在异步回调中使用 ref 获取最新值
 * setTimeout(() => {
 *   const latest = messagesRef.current  // 总是最新的值
 * }, 1000)
 * 
 * // 正常使用 setMessages 更新状态（会自动同步到 ref）
 * setMessages((prev) => [...prev, newMessage])
 * ```
 */
export function useStateWithRef<T>(
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void, React.MutableRefObject<T>] {
  const [state, setState] = useState<T>(initialValue)
  const ref = useRef<T>(initialValue)

  // 使用 useLayoutEffect 同步 state 到 ref，确保在 DOM 更新前完成
  // 这是一个防御性措施，虽然 setStateWithRef 已经同步更新了 ref
  useLayoutEffect(() => {
    ref.current = state
  }, [state])

  // 统一的更新函数，同时更新 state 和 ref
  // 在 setState 的回调中同步更新 ref，确保 ref 总是最新的
  const setStateWithRef = useCallback((value: T | ((prev: T) => T)) => {
    setState((prev) => {
      const updated = typeof value === 'function' ? (value as (prev: T) => T)(prev) : value
      ref.current = updated
      return updated
    })
  }, [])

  return [state, setStateWithRef, ref]
}

