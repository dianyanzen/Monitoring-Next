export type EspasiMenuItem = {
  MENU_ID: number;
  PARENT_ID: number | null;
  ICON?: string;
  TITLE: string;
  URL?: string;
  IS_ACTIVE?: number;
  USER_LEVEL?: number;
  MENU_LEVEL?: number;
  SUB_MENU?: EspasiMenuItem[];
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const routeFor = (section: string, leaf?: string) =>
  leaf ? `/espasi/${slugify(section)}/${slugify(leaf)}` : `/espasi/${slugify(section)}`;

const makeLeaf = (id: number, parentId: number, section: string, title: string): EspasiMenuItem => ({
  MENU_ID: id,
  PARENT_ID: parentId,
  ICON: "mdi mdi-circle-small",
  TITLE: title,
  URL: routeFor(section, title),
  IS_ACTIVE: 1,
  MENU_LEVEL: 3,
});

const makeSection = (
  id: number,
  title: string,
  icon: string,
  children: EspasiMenuItem[]
): EspasiMenuItem => ({
  MENU_ID: id,
  PARENT_ID: 9100000,
  ICON: icon,
  TITLE: title,
  URL: "#",
  IS_ACTIVE: 1,
  MENU_LEVEL: 2,
  SUB_MENU: children,
});

const ESPASI_ROOT_ID = 9100000;

export const ESPASI_MENU_TREE: EspasiMenuItem[] = [
  {
    MENU_ID: ESPASI_ROOT_ID,
    PARENT_ID: null,
    ICON: "mdi mdi-rocket-launch-outline",
    TITLE: "Espasi",
    URL: "#",
    IS_ACTIVE: 1,
    MENU_LEVEL: 1,
    SUB_MENU: [
      makeSection(9100100, "Pemanggilan", "mdi mdi-bullhorn-outline", [
        makeLeaf(9100110, 9100100, "Pemanggilan", "Panggil"),
        makeLeaf(9100120, 9100100, "Pemanggilan", "Ulang"),
        makeLeaf(9100130, 9100100, "Pemanggilan", "Lewat"),
      ]),
      makeSection(9100200, "Antrian", "mdi mdi-format-list-numbered", [
        makeLeaf(9100210, 9100200, "Antrian", "Antrian Aktif"),
        makeLeaf(9100220, 9100200, "Antrian", "Antrian Log"),
        makeLeaf(9100230, 9100200, "Antrian", "Telepon"),
        makeLeaf(9100240, 9100200, "Antrian", "Kotak Masuk"),
        makeLeaf(9100250, 9100200, "Antrian", "Kotak Keluar"),
      ]),
      makeSection(9100300, "Pengaturan", "mdi mdi-cog-outline", [
        makeLeaf(9100310, 9100300, "Pengaturan", "Antrian"),
        makeLeaf(9100320, 9100300, "Pengaturan", "Pengguna"),
        makeLeaf(9100330, 9100300, "Pengaturan", "Roles"),
        makeLeaf(9100340, 9100300, "Pengaturan", "Permissions"),
      ]),
    ],
  },
];

export function getEspasiMenuTree(): EspasiMenuItem[] {
  return ESPASI_MENU_TREE.map((node) => ({
    ...node,
    SUB_MENU: node.SUB_MENU?.map((section) => ({
      ...section,
      SUB_MENU: section.SUB_MENU?.map((leaf) => ({ ...leaf })),
    })),
  }));
}

export function appendEspasiMenu<T extends { MENU_ID: number; SUB_MENU?: T[] }>(menus: T[]): T[] {
  return [...(getEspasiMenuTree() as unknown as T[]), ...menus];
}

export function getEspasiSectionSlug(title: string): string {
  return slugify(title);
}

export function findEspasiNodeBySlug(slug: string[]) {
  const root = ESPASI_MENU_TREE[0];
  if (!root) return null;

  const sectionSlug = slug[0] ? slugify(slug[0]) : "";
  const leafSlug = slug[1] ? slugify(slug[1]) : "";

  const section = root.SUB_MENU?.find((item) => slugify(item.TITLE) === sectionSlug) ?? null;
  if (!section) {
    return slug.length === 0 ? { root, section: null, leaf: null } : null;
  }

  if (!leafSlug) {
    return { root, section, leaf: null };
  }

  const leaf = section.SUB_MENU?.find((item) => slugify(item.TITLE) === leafSlug) ?? null;
  if (!leaf) return null;

  return { root, section, leaf };
}

export function listEspasiLeaves() {
  const root = ESPASI_MENU_TREE[0];
  return root?.SUB_MENU?.flatMap((section) => section.SUB_MENU ?? []) ?? [];
}
