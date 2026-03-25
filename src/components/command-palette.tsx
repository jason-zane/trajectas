"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  Home,
  LayoutGrid,
  Brain,
  Dna,
  FileQuestion,
  ClipboardList,
  Layers,
  Building2,
  Sparkles,
  Plus,
  Sun,
  Moon,
} from "lucide-react";
import {
  CommandDialog,
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import { getAllEntities } from "@/app/actions/search";

type EntityData = {
  dimensions: { id: string; name: string; slug: string }[];
  factors: { id: string; name: string; slug: string }[];
  constructs: { id: string; name: string; slug: string }[];
  items: { id: string; name: string }[];
};

const navItems = [
  { name: "Dashboard", href: "/", icon: Home },
  { name: "Dimensions", href: "/dimensions", icon: LayoutGrid },
  { name: "Factors", href: "/factors", icon: Brain },
  { name: "Constructs", href: "/constructs", icon: Dna },
  { name: "Items", href: "/items", icon: FileQuestion },
  { name: "Assessments", href: "/assessments", icon: ClipboardList },
  { name: "Diagnostics", href: "/diagnostics", icon: Layers },
  { name: "Organizations", href: "/organizations", icon: Building2 },
  { name: "Matching", href: "/matching", icon: Sparkles },
];

const quickActions = [
  { name: "Create Dimension", href: "/dimensions/create", icon: Plus },
  { name: "Create Factor", href: "/factors/create", icon: Plus },
  { name: "Create Construct", href: "/constructs/create", icon: Plus },
  { name: "Create Item", href: "/items/create", icon: Plus },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [entities, setEntities] = useState<EntityData | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { setTheme, theme } = useTheme();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const loadEntities = useCallback(async () => {
    if (entities || loading) return;
    setLoading(true);
    try {
      const data = await getAllEntities();
      setEntities(data);
    } finally {
      setLoading(false);
    }
  }, [entities, loading]);

  useEffect(() => {
    if (open && !entities) {
      loadEntities();
    }
  }, [open, entities, loadEntities]);

  const runCommand = useCallback(
    (command: () => void) => {
      setOpen(false);
      command();
    },
    []
  );

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <Command>
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>

          <CommandGroup heading="Navigation">
            {navItems.map((item) => (
              <CommandItem
                key={item.href}
                onSelect={() => runCommand(() => router.push(item.href))}
              >
                <item.icon className="size-4 text-muted-foreground" />
                <span>{item.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Quick Actions">
            {quickActions.map((item) => (
              <CommandItem
                key={item.href}
                onSelect={() => runCommand(() => router.push(item.href))}
              >
                <item.icon className="size-4 text-muted-foreground" />
                <span>{item.name}</span>
              </CommandItem>
            ))}
            <CommandItem
              onSelect={() =>
                runCommand(() =>
                  setTheme(theme === "dark" ? "light" : "dark")
                )
              }
            >
              {theme === "dark" ? (
                <Sun className="size-4 text-muted-foreground" />
              ) : (
                <Moon className="size-4 text-muted-foreground" />
              )}
              <span>Toggle Theme</span>
            </CommandItem>
          </CommandGroup>

          {entities && (
            <>
              {entities.dimensions.length > 0 && (
                <>
                  <CommandSeparator />
                  <CommandGroup heading="Dimensions">
                    {entities.dimensions.map((d) => (
                      <CommandItem
                        key={d.id}
                        onSelect={() =>
                          runCommand(() =>
                            router.push(`/dimensions/${d.slug}/edit`)
                          )
                        }
                      >
                        <LayoutGrid className="size-4 text-dimension-accent" />
                        <span>{d.name}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}

              {entities.factors.length > 0 && (
                <>
                  <CommandSeparator />
                  <CommandGroup heading="Factors">
                    {entities.factors.map((f) => (
                      <CommandItem
                        key={f.id}
                        onSelect={() =>
                          runCommand(() =>
                            router.push(`/factors/${f.slug}/edit`)
                          )
                        }
                      >
                        <Brain className="size-4 text-competency-accent" />
                        <span>{f.name}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}

              {entities.constructs.length > 0 && (
                <>
                  <CommandSeparator />
                  <CommandGroup heading="Constructs">
                    {entities.constructs.map((c) => (
                      <CommandItem
                        key={c.id}
                        onSelect={() =>
                          runCommand(() =>
                            router.push(`/constructs/${c.slug}/edit`)
                          )
                        }
                      >
                        <Dna className="size-4 text-trait-accent" />
                        <span>{c.name}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}

              {entities.items.length > 0 && (
                <>
                  <CommandSeparator />
                  <CommandGroup heading="Items">
                    {entities.items.map((i) => (
                      <CommandItem
                        key={i.id}
                        onSelect={() =>
                          runCommand(() =>
                            router.push(`/items/${i.id}/edit`)
                          )
                        }
                      >
                        <FileQuestion className="size-4 text-item-accent" />
                        <span className="truncate">{i.name}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}
            </>
          )}
        </CommandList>

        <div className="border-t border-border/50 px-3 py-2">
          <p className="text-overline text-muted-foreground text-center">
            ↑↓ Navigate &middot; ↵ Select &middot; Esc Close
          </p>
        </div>
      </Command>
    </CommandDialog>
  );
}
