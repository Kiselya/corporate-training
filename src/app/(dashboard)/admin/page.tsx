"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Shield,
  Plus,
  Copy,
  Check,
  Loader2,
  Ban,
  Users,
  Ticket,
  Tag,
  UserCheck,
  Trash2,
  Mail,
} from "lucide-react";
import { useAuth, isAdminOrAbove, isSuperAdmin, ROLE_LABELS } from "@/lib/auth-context";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

/* ---------- Types ---------- */
interface Invite {
  id: string;
  token: string;
  role: "SUPER_ADMIN" | "ADMIN" | "USER";
  maxUses: number;
  usedCount: number;
  isActive: boolean;
  usedBy?: { id: string; email: string; name: string | null; role: string } | null;
}

interface PromoCode {
  id: string;
  code: string;
  discountPercent: number;
  description: string | null;
  validTo: string | null;
  usedCount: number;
  isActive: boolean;
}

/* ========== Component ========== */
export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && (!user || !isAdminOrAbove(user.role))) {
      router.push("/");
    }
  }, [user, authLoading, router]);

  if (authLoading || !user || !isAdminOrAbove(user.role)) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-6 w-6 text-slate-700" />
        <h1 className="text-2xl font-bold tracking-tight">Администрирование</h1>
      </div>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">
            <Users className="h-4 w-4" />
            Пользователи
          </TabsTrigger>
          <TabsTrigger value="invites">
            <Ticket className="h-4 w-4" />
            Инвайты
          </TabsTrigger>
          {/* Промокоды — только для SUPER_ADMIN */}
          {isSuperAdmin(user.role) && (
            <TabsTrigger value="promos">
              <Tag className="h-4 w-4" />
              Промокоды
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="users">
          <UsersTab currentUser={user} />
        </TabsContent>
        <TabsContent value="invites">
          <InvitesTab />
        </TabsContent>
        {isSuperAdmin(user.role) && (
          <TabsContent value="promos">
            <PromosTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

/* ---------- Company Select with Search ---------- */
function CompanySelect({
  value,
  companies,
  onChange,
  disabled,
}: {
  value: string | null | undefined;
  companies: { id: string; name: string }[];
  onChange: (companyId: string | null) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const filtered = search
    ? companies.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    : companies;

  const selectedName = value ? companies.find((c) => c.id === value)?.name || "—" : "Не привязан";

  // Позиционирование dropdown под кнопкой (fixed)
  useEffect(() => {
    if (open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.left });
    }
  }, [open]);

  // Закрытие при клике вне
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        btnRef.current?.contains(e.target as Node) ||
        dropRef.current?.contains(e.target as Node)
      ) return;
      setOpen(false);
      setSearch("");
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-40 h-8 px-2 text-xs border rounded-md bg-white hover:bg-slate-50 disabled:opacity-50"
      >
        <span className="truncate">{selectedName}</span>
        <span className="text-slate-400 ml-1">▾</span>
      </button>
      {open && (
        <div
          ref={dropRef}
          className="fixed z-[9999] w-64 bg-white border rounded-lg shadow-xl"
          style={{ top: pos.top, left: pos.left }}
        >
          <div className="p-2 border-b">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск компании..."
              className="w-full h-7 px-2 text-xs border rounded focus:outline-none focus:border-blue-400"
              autoFocus
            />
          </div>
          <div className="max-h-48 overflow-y-auto" style={{ overflowX: "hidden" }}>
            <div className="flex flex-col py-1">
              <button
                type="button"
                onClick={() => { onChange(null); setOpen(false); setSearch(""); }}
                className={`block w-full text-left px-3 py-1.5 text-xs hover:bg-slate-100 ${!value ? "bg-blue-50 font-medium" : ""}`}
              >
                Не привязан
              </button>
              {filtered.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => { onChange(c.id); setOpen(false); setSearch(""); }}
                  className={`block w-full text-left px-3 py-1.5 text-xs hover:bg-slate-100 ${value === c.id ? "bg-blue-50 font-medium" : ""}`}
                >
                  {c.name}
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="px-3 py-2 text-xs text-slate-400">Ничего не найдено</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ---------- Users Tab ---------- */
interface UserItem {
  id: string;
  email: string;
  name: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
  companyId?: string | null;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

function UsersTab({ currentUser }: { currentUser: { id: string; email: string; name: string; role: string; companyId?: string | null } }) {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [allCompanies, setAllCompanies] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  const router = useRouter();

  const fetchUsers = useCallback(async () => {
    try {
      const [usersRes, companiesRes] = await Promise.all([
        fetch("/api/auth/users"),
        fetch("/api/companies"),
      ]);
      if (usersRes.ok) {
        let data = await usersRes.json();
        if (currentUser.role === "ADMIN" && currentUser.companyId) {
          data = data.filter((u: UserItem) => u.companyId === currentUser.companyId);
        }
        setUsers(data);
      }
      if (companiesRes.ok) {
        const compData = await companiesRes.json();
        setAllCompanies(compData);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [currentUser.role, currentUser.companyId]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  async function changeRole(userId: string, newRole: string) {
    setUpdatingId(userId);
    try {
      const res = await fetch(`/api/auth/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        alert(data?.error || "Ошибка");
      }
      await fetchUsers();
    } finally {
      setUpdatingId(null);
    }
  }

  async function changeCompany(userId: string, companyId: string | null) {
    setUpdatingId(userId);
    try {
      const res = await fetch(`/api/auth/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        alert(data?.error || "Ошибка");
      }
      await fetchUsers();
    } finally {
      setUpdatingId(null);
    }
  }

  async function toggleActive(userId: string, isActive: boolean) {
    setUpdatingId(userId);
    try {
      const res = await fetch(`/api/auth/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        alert(data?.error || "Ошибка");
      }
      await fetchUsers();
    } finally {
      setUpdatingId(null);
    }
  }

  async function impersonateUser(userId: string) {
    setUpdatingId(userId);
    try {
      const res = await fetch("/api/auth/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        router.push("/");
        // Force full page reload to re-fetch auth context
        window.location.href = "/";
      } else {
        const data = await res.json().catch(() => null);
        alert(data?.error || "Ошибка");
      }
    } finally {
      setUpdatingId(null);
    }
  }

  function copyEmail(email: string, userId: string) {
    navigator.clipboard.writeText(email);
    setCopiedEmail(userId);
    setTimeout(() => setCopiedEmail(null), 2000);
  }

  const canChangeRoles = isSuperAdmin(currentUser.role as any);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Пользователи ({users.length})</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Имя</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Роль</TableHead>
                {canChangeRoles && <TableHead>Компания</TableHead>}
                <TableHead>Дата регистрации</TableHead>
                <TableHead>Статус</TableHead>
                {canChangeRoles && <TableHead className="text-right">Действия</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => {
                const isMe = u.id === currentUser.id;
                return (
                  <TableRow key={u.id} className={!u.isActive ? "opacity-50" : ""}>
                    <TableCell className="font-medium">
                      {u.name || "\u2014"}
                      {isMe && <span className="ml-1 text-xs text-muted-foreground">(вы)</span>}
                    </TableCell>
                    <TableCell>
                      <button
                        className="group flex items-center gap-1.5 text-sm text-muted-foreground hover:text-blue-600 transition-colors"
                        onClick={() => copyEmail(u.email, u.id)}
                        title="Скопировать email"
                      >
                        {u.email}
                        {copiedEmail === u.id ? (
                          <Check className="h-3 w-3 text-green-500" />
                        ) : (
                          <Copy className="h-3 w-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                        )}
                      </button>
                    </TableCell>
                    <TableCell>
                      {canChangeRoles && !isMe ? (
                        <Select
                          value={u.role}
                          onValueChange={(val) => val && changeRole(u.id, val)}
                          disabled={updatingId === u.id}
                        >
                          <SelectTrigger className="w-40 h-8 text-xs">
                            <SelectValue>{ROLE_LABELS[u.role as keyof typeof ROLE_LABELS] || u.role}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="SUPER_ADMIN">Суперадмин</SelectItem>
                            <SelectItem value="ADMIN">Администратор</SelectItem>
                            <SelectItem value="USER">Пользователь</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <RoleBadge role={u.role} />
                      )}
                    </TableCell>
                    {canChangeRoles && (
                      <TableCell>
                        {!isMe ? (
                          <CompanySelect
                            value={u.companyId}
                            companies={allCompanies}
                            onChange={(val) => changeCompany(u.id, val)}
                            disabled={updatingId === u.id}
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {u.companyId ? allCompanies.find(c => c.id === u.companyId)?.name || "—" : "—"}
                          </span>
                        )}
                      </TableCell>
                    )}
                    <TableCell className="text-sm text-muted-foreground">
                      {u.createdAt ? formatDate(u.createdAt) : "\u2014"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={u.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}>
                        {u.isActive ? "Активен" : "Заблокирован"}
                      </Badge>
                    </TableCell>
                    {canChangeRoles && (
                      <TableCell className="text-right">
                        {!isMe && (
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => impersonateUser(u.id)}
                              disabled={updatingId === u.id}
                              className="text-blue-500 hover:text-blue-700"
                              title="Войти как этот пользователь"
                            >
                              <UserCheck className="h-3.5 w-3.5 mr-1" />
                              Войти как
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleActive(u.id, !u.isActive)}
                              disabled={updatingId === u.id}
                              className={u.isActive ? "text-red-500 hover:text-red-700" : "text-green-600 hover:text-green-700"}
                            >
                              {u.isActive ? (
                                <><Ban className="h-3.5 w-3.5 mr-1" /> Заблокировать</>
                              ) : (
                                <><Check className="h-3.5 w-3.5 mr-1" /> Разблокировать</>
                              )}
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

/* ---------- Invites Tab ---------- */
function InvitesTab() {
  const { user: currentUser } = useAuth();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  /* form state */
  const [newRole, setNewRole] = useState<"SUPER_ADMIN" | "ADMIN" | "USER">("USER");
  const [newMaxUses, setNewMaxUses] = useState("10");
  const [newEmail, setNewEmail] = useState("");
  const [newCompanyId, setNewCompanyId] = useState<string>("none");
  const [allCompaniesInv, setAllCompaniesInv] = useState<{ id: string; name: string }[]>([]);
  const [creating, setCreating] = useState(false);
  const [createResult, setCreateResult] = useState<string | null>(null);

  const isSuperAdminUser = isSuperAdmin(currentUser?.role);

  const fetchInvites = useCallback(async () => {
    try {
      const [invRes, compRes] = await Promise.all([
        fetch("/api/auth/invites"),
        fetch("/api/companies"),
      ]);
      if (invRes.ok) {
        const data = await invRes.json();
        const list: Invite[] = data.invites ?? data;
        list.sort((a, b) => {
          if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
          return 0;
        });
        setInvites(list);
      }
      if (compRes.ok) {
        setAllCompaniesInv(await compRes.json());
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvites();
  }, [fetchInvites]);

  async function handleCreate() {
    setCreating(true);
    setCreateResult(null);
    try {
      const payload: Record<string, unknown> = { role: newRole, maxUses: Number(newMaxUses) };
      if (newEmail.trim()) {
        payload.email = newEmail.trim();
      }
      if (newCompanyId !== "none") {
        payload.companyId = newCompanyId;
      }
      const res = await fetch("/api/auth/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        if (newEmail.trim() && data.emailSent) {
          setCreateResult(`Приглашение отправлено на ${newEmail.trim()}`);
        } else if (newEmail.trim() && !data.emailSent) {
          setCreateResult(`Ссылка создана, но не удалось отправить email на ${newEmail.trim()}`);
        } else {
          setCreateResult("Ссылка создана (без отправки на email)");
        }
        setNewRole("USER");
        setNewMaxUses("10");
        setNewEmail("");
        fetchInvites();
        // Auto-close after showing result
        setTimeout(() => {
          setCreateOpen(false);
          setCreateResult(null);
        }, 3000);
      }
    } finally {
      setCreating(false);
    }
  }

  function getInviteUrl(token: string) {
    return `${window.location.origin}/register?token=${token}`;
  }

  async function copyToClipboard(invite: Invite) {
    await navigator.clipboard.writeText(getInviteUrl(invite.token));
    setCopiedId(invite.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  async function deactivateInvite(id: string) {
    setUpdatingId(id);
    try {
      await fetch(`/api/auth/invites/${id}`, { method: "DELETE" });
      await fetchInvites();
    } finally {
      setUpdatingId(null);
    }
  }

  async function activateInvite(id: string) {
    setUpdatingId(id);
    try {
      // Re-activate by updating isActive to true
      await fetch(`/api/auth/invites/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true }),
      });
      await fetchInvites();
    } finally {
      setUpdatingId(null);
    }
  }

  async function deleteInvite(id: string) {
    if (!confirm("Удалить приглашение навсегда?")) return;
    setUpdatingId(id);
    try {
      await fetch(`/api/auth/invites/${id}?permanent=true`, { method: "DELETE" });
      await fetchInvites();
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Инвайт-ссылки</CardTitle>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Создать инвайт
        </Button>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Новый инвайт</DialogTitle>
              <DialogDescription>
                Создайте ссылку-приглашение для регистрации новых пользователей.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Роль</Label>
                {/* ADMIN может создавать инвайты только с ролью USER */}
                {isSuperAdminUser ? (
                  <Select value={newRole} onValueChange={(val) => setNewRole(val as "SUPER_ADMIN" | "ADMIN" | "USER")}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USER">Пользователь</SelectItem>
                      <SelectItem value="ADMIN">Администратор</SelectItem>
                      <SelectItem value="SUPER_ADMIN">Суперадмин</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="flex items-center h-10 px-3 rounded-md border bg-slate-50 text-sm text-slate-700">
                    Пользователь
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxUses">Макс. использований</Label>
                <Input
                  id="maxUses"
                  type="number"
                  min="1"
                  value={newMaxUses}
                  onChange={(e) => setNewMaxUses(e.target.value)}
                />
              </div>
              {isSuperAdminUser && (
                <div className="space-y-2">
                  <Label>Компания (опционально)</Label>
                  <select
                    className="w-full h-10 px-3 border rounded-md text-sm bg-white"
                    value={newCompanyId}
                    onChange={(e) => setNewCompanyId(e.target.value)}
                  >
                    <option value="none">Без привязки к компании</option>
                    {allCompaniesInv.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    Зарегистрированный пользователь будет автоматически привязан к этой компании.
                  </p>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="inviteEmail">Email получателя (опционально)</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="inviteEmail"
                    type="email"
                    placeholder="name@company.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Если указан — ссылка будет отправлена на email. Если нет — только создаст ссылку.
                </p>
              </div>
              {createResult && (
                <div className="rounded-md bg-blue-50 border border-blue-200 px-3 py-2 text-sm text-blue-800">
                  {createResult}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button onClick={handleCreate} disabled={creating}>
                {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                Создать
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : invites.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Инвайт-ссылки пока не созданы
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ссылка</TableHead>
                <TableHead>Роль</TableHead>
                <TableHead>Использовано</TableHead>
                <TableHead>Зарегистрировался</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invites.map((invite) => (
                <TableRow
                  key={invite.id}
                  className={!invite.isActive ? "bg-slate-50" : ""}
                >
                  <TableCell>
                    <button
                      className="group flex items-center gap-1.5 font-mono text-xs hover:text-blue-600 transition-colors"
                      onClick={() => copyToClipboard(invite)}
                      title="Скопировать полную ссылку"
                    >
                      {invite.token.slice(0, 12)}...
                      {copiedId === invite.id ? (
                        <Check className="h-3 w-3 text-green-500" />
                      ) : (
                        <Copy className="h-3 w-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </button>
                  </TableCell>
                  <TableCell>
                    <RoleBadge role={invite.role} />
                  </TableCell>
                  <TableCell className="text-sm">
                    {invite.usedCount}/{invite.maxUses}
                  </TableCell>
                  <TableCell className="text-sm">
                    {invite.usedBy ? (
                      <div>
                        <span className="font-medium">{invite.usedBy.name || invite.usedBy.email}</span>
                        {invite.usedBy.name && (
                          <span className="block text-xs text-slate-400">{invite.usedBy.email}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {invite.isActive ? (
                      <Badge variant="secondary" className="bg-green-100 text-green-700">
                        Активна
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-slate-100 text-slate-500">
                        Неактивна
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {invite.isActive ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deactivateInvite(invite.id)}
                          disabled={updatingId === invite.id}
                          className="text-red-500 hover:text-red-700"
                          title="Деактивировать"
                        >
                          <Ban className="h-3.5 w-3.5 mr-1" />
                          Деактивировать
                        </Button>
                      ) : (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => activateInvite(invite.id)}
                            disabled={updatingId === invite.id}
                            className="text-green-600 hover:text-green-700"
                            title="Активировать"
                          >
                            <Check className="h-3.5 w-3.5 mr-1" />
                            Активировать
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteInvite(invite.id)}
                            disabled={updatingId === invite.id}
                            className="text-red-500 hover:text-red-700"
                            title="Удалить навсегда"
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1" />
                            Удалить
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

/* ---------- Promo Codes Tab ---------- */
function PromosTab() {
  const [promos, setPromos] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  /* form state */
  const [newCode, setNewCode] = useState("");
  const [newDiscount, setNewDiscount] = useState("10");
  const [newDescription, setNewDescription] = useState("");
  const [newValidTo, setNewValidTo] = useState("");
  const [creating, setCreating] = useState(false);
  const [copiedPromoId, setCopiedPromoId] = useState<string | null>(null);

  const fetchPromos = useCallback(async () => {
    try {
      const res = await fetch("/api/promo-codes");
      if (res.ok) {
        const data = await res.json();
        setPromos(data.promoCodes ?? data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPromos();
  }, [fetchPromos]);

  async function handleCreate() {
    setCreating(true);
    try {
      const res = await fetch("/api/promo-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: newCode.toUpperCase(),
          discountPercent: Number(newDiscount),
          description: newDescription || null,
          validTo: newValidTo || null,
        }),
      });
      if (res.ok) {
        setCreateOpen(false);
        setNewCode("");
        setNewDiscount("10");
        setNewDescription("");
        setNewValidTo("");
        fetchPromos();
      }
    } finally {
      setCreating(false);
    }
  }

  async function togglePromo(id: string, isActive: boolean) {
    await fetch(`/api/promo-codes/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive }),
    });
    fetchPromos();
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Промокоды</CardTitle>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger render={<Button size="sm" />}>
            <Plus className="h-4 w-4" />
            Создать промокод
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Новый промокод</DialogTitle>
              <DialogDescription>
                Создайте промокод для скидки на обучение.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="promoCode">Код</Label>
                <Input
                  id="promoCode"
                  placeholder="PROMO2026"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="promoDiscount">Скидка (%)</Label>
                <Input
                  id="promoDiscount"
                  type="number"
                  min="1"
                  max="100"
                  value={newDiscount}
                  onChange={(e) => setNewDiscount(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="promoDesc">Описание</Label>
                <Input
                  id="promoDesc"
                  placeholder="Описание промокода"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="promoValidTo">Действителен до</Label>
                <Input
                  id="promoValidTo"
                  type="date"
                  value={newValidTo}
                  onChange={(e) => setNewValidTo(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreate} disabled={creating}>
                {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                Создать
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : promos.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Промокоды пока не созданы
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Код</TableHead>
                <TableHead>Скидка</TableHead>
                <TableHead>Описание</TableHead>
                <TableHead>Использовано</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {promos.map((promo) => (
                <TableRow key={promo.id} className={!promo.isActive ? "opacity-50" : ""}>
                  <TableCell>
                    <button
                      className="group flex items-center gap-1.5 font-mono font-medium hover:text-blue-600 transition-colors"
                      onClick={() => {
                        navigator.clipboard.writeText(promo.code);
                        setCopiedPromoId(promo.id);
                        setTimeout(() => setCopiedPromoId(null), 2000);
                      }}
                      title="Скопировать код"
                    >
                      {promo.code}
                      {copiedPromoId === promo.id ? (
                        <Check className="h-3.5 w-3.5 text-green-500" />
                      ) : (
                        <Copy className="h-3.5 w-3.5 text-slate-300 group-hover:text-blue-400" />
                      )}
                    </button>
                  </TableCell>
                  <TableCell>{promo.discountPercent}%</TableCell>
                  <TableCell className="max-w-[200px] truncate text-muted-foreground">
                    {promo.description || "—"}
                  </TableCell>
                  <TableCell>{promo.usedCount}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={promo.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}>
                      {promo.isActive ? "Активен" : "Неактивен"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => togglePromo(promo.id, !promo.isActive)}
                      className={promo.isActive ? "text-red-500 hover:text-red-700" : "text-green-600 hover:text-green-700"}
                    >
                      {promo.isActive ? (
                        <><Ban className="h-3.5 w-3.5 mr-1" /> Деактивировать</>
                      ) : (
                        <><Check className="h-3.5 w-3.5 mr-1" /> Активировать</>
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

/* ---------- Shared: Role Badge ---------- */
function RoleBadge({ role }: { role: string }) {
  if (role === "SUPER_ADMIN") {
    return (
      <Badge variant="secondary" className="bg-red-100 text-red-700">
        Суперадмин
      </Badge>
    );
  }
  if (role === "ADMIN") {
    return (
      <Badge variant="secondary" className="bg-amber-100 text-amber-700">
        Администратор
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="bg-blue-100 text-blue-700">
      Пользователь
    </Badge>
  );
}
