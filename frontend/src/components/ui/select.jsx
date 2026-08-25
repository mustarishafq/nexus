"use client"

import * as React from "react"
import * as SelectPrimitive from "@radix-ui/react-select"
import { Check, ChevronDown, ChevronUp, Search } from "lucide-react"

import { cn } from "@/lib/utils"

const Select = SelectPrimitive.Root

const SelectGroup = SelectPrimitive.Group

const SelectValue = SelectPrimitive.Value

const SelectTrigger = React.forwardRef(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      "flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm ring-offset-background data-[placeholder]:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm [&>span]:line-clamp-1",
      className
    )}
    {...props}>
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 opacity-50" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
))
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName

const SelectScrollUpButton = React.forwardRef(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpButton
    ref={ref}
    className={cn("flex cursor-default items-center justify-center py-1", className)}
    {...props}>
    <ChevronUp className="h-4 w-4" />
  </SelectPrimitive.ScrollUpButton>
))
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName

const SelectScrollDownButton = React.forwardRef(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownButton
    ref={ref}
    className={cn("flex cursor-default items-center justify-center py-1", className)}
    {...props}>
    <ChevronDown className="h-4 w-4" />
  </SelectPrimitive.ScrollDownButton>
))
SelectScrollDownButton.displayName =
  SelectPrimitive.ScrollDownButton.displayName

function nodeText(node) {
  if (node == null || typeof node === "boolean") return ""
  if (typeof node === "string" || typeof node === "number") return String(node)
  if (Array.isArray(node)) return node.map(nodeText).join(" ")
  if (React.isValidElement(node)) return nodeText(node.props.children)
  return ""
}

function isSelectItem(child) {
  return React.isValidElement(child) && child.props?.value != null
}

function itemMatchesQuery(child, query) {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  const text = nodeText(child.props.children)
  const value = String(child.props.value ?? "")
  return text.toLowerCase().includes(needle) || value.toLowerCase().includes(needle)
}

function filterSelectChildren(children, query) {
  return React.Children.map(children, (child) => {
    if (!React.isValidElement(child)) return child
    if (isSelectItem(child)) return itemMatchesQuery(child, query) ? child : null
    if (child.props?.children) {
      const next = filterSelectChildren(child.props.children, query)
      const hasMatch = React.Children.toArray(next).some(Boolean)
      if (!hasMatch) return null
      return React.cloneElement(child, undefined, next)
    }
    return child
  })
}

function countSelectItems(children) {
  let count = 0
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return
    if (isSelectItem(child)) count += 1
    else if (child.props?.children) count += countSelectItems(child.props.children)
  })
  return count
}

const SelectContent = React.forwardRef(({
  className,
  children,
  position = "popper",
  searchable = true,
  searchPlaceholder = "Search...",
  onCloseAutoFocus,
  onOpenAutoFocus,
  ...props
}, ref) => {
  const inputRef = React.useRef(null)
  const [query, setQuery] = React.useState("")

  const filteredChildren = searchable && query.trim()
    ? filterSelectChildren(children, query)
    : children
  const matchCount = countSelectItems(filteredChildren)

  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        ref={ref}
        className={cn(
          "relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
          position === "popper" &&
            "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
          className
        )}
        position={position}
        onOpenAutoFocus={(event) => {
          if (searchable) {
            event.preventDefault()
            requestAnimationFrame(() => inputRef.current?.focus())
          }
          onOpenAutoFocus?.(event)
        }}
        onCloseAutoFocus={(event) => {
          setQuery("")
          onCloseAutoFocus?.(event)
        }}
        {...props}>
        {searchable ? (
          <div className="sticky top-0 z-10 border-b border-border bg-popover px-2 py-2">
            <div className="flex items-center rounded-md border border-input bg-background px-2">
              <Search className="mr-2 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                autoComplete="off"
                className="h-8 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => event.stopPropagation()}
                onPointerDown={(event) => event.stopPropagation()}
              />
            </div>
          </div>
        ) : null}
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport
          className={cn(
            "p-1",
            position === "popper" && "w-full min-w-[var(--radix-select-trigger-width)]",
            searchable
              ? "max-h-72"
              : position === "popper" && "h-[var(--radix-select-trigger-height)]"
          )}>
          {filteredChildren}
          {searchable && query.trim() && matchCount === 0 ? (
            <div className="px-2 py-6 text-center text-sm text-muted-foreground">
              No matches
            </div>
          ) : null}
        </SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  )
})
SelectContent.displayName = SelectPrimitive.Content.displayName

const SelectLabel = React.forwardRef(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn("px-2 py-1.5 text-sm font-semibold", className)}
    {...props} />
))
SelectLabel.displayName = SelectPrimitive.Label.displayName

const SelectItem = React.forwardRef(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    {...props}>
    <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
))
SelectItem.displayName = SelectPrimitive.Item.displayName

const SelectSeparator = React.forwardRef(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-muted", className)}
    {...props} />
))
SelectSeparator.displayName = SelectPrimitive.Separator.displayName

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
}
