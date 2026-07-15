import { assertEligibleAge, getAgePool } from "@/lib/age";
import type { KidsRepository } from "@/lib/data/repository";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  Attendance,
  AttendanceWithChild,
  Child,
  ChildWithParent,
  Parent,
  RegisterInput,
  Session,
} from "@/lib/types";

type ParentRow = {
  id: string;
  full_name: string;
  address: string;
  contact_number: string;
  created_at: string;
};

type ChildRow = {
  id: string;
  parent_id: string;
  first_name: string;
  last_name: string;
  birthday: string;
  home_service: string;
  created_at: string;
  parents?: ParentRow | ParentRow[] | null;
};

type SessionRow = {
  id: string;
  started_at: string;
  ended_at: string | null;
  status: "open" | "closed";
};

type AttendanceRow = {
  id: string;
  session_id: string;
  child_id: string;
  time_in: string;
  time_out: string | null;
  claimant_name: string | null;
  rfid_tag_id: string | null;
  children?: ChildRow | ChildRow[] | null;
};

function mapParent(row: ParentRow): Parent {
  return {
    id: row.id,
    fullName: row.full_name,
    address: row.address,
    contactNumber: row.contact_number,
    createdAt: row.created_at,
  };
}

function mapChild(row: ChildRow, parent?: Parent): ChildWithParent {
  const parentRow = Array.isArray(row.parents) ? row.parents[0] : row.parents;
  const resolved = parent ?? (parentRow ? mapParent(parentRow) : undefined);
  if (!resolved) throw new Error("Parent missing for child");
  return {
    id: row.id,
    parentId: row.parent_id,
    firstName: row.first_name,
    lastName: row.last_name,
    birthday: row.birthday,
    homeService: row.home_service,
    createdAt: row.created_at,
    parent: resolved,
  };
}

function mapSession(row: SessionRow): Session {
  return {
    id: row.id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    status: row.status,
  };
}

function mapAttendance(row: AttendanceRow): AttendanceWithChild {
  const childRow = Array.isArray(row.children) ? row.children[0] : row.children;
  if (!childRow) throw new Error("Child missing for attendance");
  const child = mapChild(childRow);
  const agePool = getAgePool(child.birthday);
  if (!agePool) {
    throw new Error("Checked-in child is outside the Kids Church age range");
  }
  return {
    id: row.id,
    sessionId: row.session_id,
    childId: row.child_id,
    timeIn: row.time_in,
    timeOut: row.time_out,
    claimantName: row.claimant_name,
    rfidTagId: row.rfid_tag_id,
    child,
    agePool,
  };
}

function db() {
  // Staff-owned kiosk: server actions use service role scoped to TENANT_SCHEMA.
  // Authenticated staff login (profiles.tenant) can replace this later.
  return createAdminClient();
}

export const supabaseRepository: KidsRepository = {
  async getOpenSession() {
    const supabase = db();
    const { data, error } = await supabase
      .from("sessions")
      .select("*")
      .eq("status", "open")
      .maybeSingle();
    if (error) throw error;
    return data ? mapSession(data as SessionRow) : null;
  },

  async listSessions() {
    const supabase = db();
    const { data, error } = await supabase
      .from("sessions")
      .select("*")
      .order("started_at", { ascending: false });
    if (error) throw error;
    return ((data ?? []) as SessionRow[]).map(mapSession);
  },

  async startSession() {
    const supabase = db();
    const { data, error } = await supabase
      .from("sessions")
      .insert({ status: "open" })
      .select("*")
      .single();
    if (error) throw error;
    return mapSession(data as SessionRow);
  },

  async closeSession(sessionId) {
    const supabase = db();
    const { data, error } = await supabase
      .from("sessions")
      .update({ status: "closed", ended_at: new Date().toISOString() })
      .eq("id", sessionId)
      .eq("status", "open")
      .select("*")
      .single();
    if (error) throw error;
    return mapSession(data as SessionRow);
  },

  async searchChildren(query) {
    const supabase = db();
    let req = supabase
      .from("children")
      .select("*, parents(*)")
      .order("last_name")
      .order("first_name");

    const q = query.trim();
    if (q) {
      // Simple OR ilike across child + parent names via filter string
      req = req.or(
        `first_name.ilike.%${q}%,last_name.ilike.%${q}%`,
      );
    }

    const { data, error } = await req;
    if (error) throw error;
    const rows = ((data ?? []) as ChildRow[]).map((row) => mapChild(row));

    if (!q) return rows;
    const lower = q.toLowerCase();
    return rows.filter((c) =>
      `${c.firstName} ${c.lastName} ${c.parent.fullName}`
        .toLowerCase()
        .includes(lower),
    );
  },

  async registerFamily(input: RegisterInput) {
    for (const child of input.children) {
      assertEligibleAge(child.birthday);
    }

    const supabase = db();
    const { data: parentRow, error: parentError } = await supabase
      .from("parents")
      .insert({
        full_name: input.parent.fullName.trim(),
        address: input.parent.address.trim(),
        contact_number: input.parent.contactNumber.trim(),
      })
      .select("*")
      .single();
    if (parentError) throw parentError;

    const parent = mapParent(parentRow as ParentRow);
    const { data: childRows, error: childError } = await supabase
      .from("children")
      .insert(
        input.children.map((c) => ({
          parent_id: parent.id,
          first_name: c.firstName.trim(),
          last_name: c.lastName.trim(),
          birthday: c.birthday,
          home_service: c.homeService.trim() || "Church Service",
        })),
      )
      .select("*");
    if (childError) throw childError;

    const children: Child[] = ((childRows ?? []) as ChildRow[]).map((row) => {
      const mapped = mapChild(row, parent);
      const { parent: _p, ...rest } = mapped;
      return rest;
    });

    return { parent, children };
  },

  async listActiveAttendance(sessionId) {
    const supabase = db();
    const { data, error } = await supabase
      .from("attendance")
      .select("*, children(*, parents(*))")
      .eq("session_id", sessionId)
      .is("time_out", null)
      .order("time_in");
    if (error) throw error;
    return ((data ?? []) as AttendanceRow[]).map(mapAttendance);
  },

  async checkIn(sessionId, childId) {
    const supabase = db();
    const { data: childRow, error: childError } = await supabase
      .from("children")
      .select("birthday")
      .eq("id", childId)
      .single();
    if (childError) throw childError;
    assertEligibleAge((childRow as { birthday: string }).birthday);

    const { data, error } = await supabase
      .from("attendance")
      .insert({ session_id: sessionId, child_id: childId })
      .select("*")
      .single();
    if (error) throw error;
    const row = data as AttendanceRow;
    return {
      id: row.id,
      sessionId: row.session_id,
      childId: row.child_id,
      timeIn: row.time_in,
      timeOut: row.time_out,
      claimantName: row.claimant_name,
      rfidTagId: row.rfid_tag_id,
    } satisfies Attendance;
  },

  async checkOut(attendanceId, claimantName) {
    const supabase = db();
    const name = claimantName.trim();
    if (!name) throw new Error("Claimant name is required");
    const { data, error } = await supabase
      .from("attendance")
      .update({
        time_out: new Date().toISOString(),
        claimant_name: name,
      })
      .eq("id", attendanceId)
      .is("time_out", null)
      .select("*")
      .single();
    if (error) throw error;
    const row = data as AttendanceRow;
    return {
      id: row.id,
      sessionId: row.session_id,
      childId: row.child_id,
      timeIn: row.time_in,
      timeOut: row.time_out,
      claimantName: row.claimant_name,
      rfidTagId: row.rfid_tag_id,
    };
  },

  async listAttendanceForSession(sessionId) {
    const supabase = db();
    const { data, error } = await supabase
      .from("attendance")
      .select("*, children(*, parents(*))")
      .eq("session_id", sessionId)
      .order("time_in");
    if (error) throw error;
    return ((data ?? []) as AttendanceRow[]).map(mapAttendance);
  },
};
