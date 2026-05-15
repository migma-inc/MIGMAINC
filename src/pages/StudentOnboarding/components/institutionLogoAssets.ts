type InstitutionLogoSource = {
  logo_url?: string | null;
  slug?: string | null;
  name?: string | null;
};

const LOCAL_INSTITUTION_BANNERS: Record<string, string> = {
  'caroline-university': '/institution-banners/caroline-university.png',
  'oikos-university': '/institution-banners/oikos-university.png',
  'aae-san-francisco': '/institution-banners/aae-san-francisco.png',
  'ala-charlotte': '/institution-banners/ala-charlotte.png',
  'csi-computer-systems-institute': '/institution-banners/csi-computer-systems-institute.png',
  'excel-dallas': '/institution-banners/excel-dallas.png',
  'ili-washington': '/institution-banners/ili-washington.png',
  'internexus-provo': '/institution-banners/internexus-provo.png',
  'trine-university': '/institution-banners/trine-university.png',
  'american-national-university': '/institution-banners/american-national-university.png',
  'uceda-school-orlando': '/institution-banners/uceda-school-orlando.png',
  'uceda-school-las-vegas': '/institution-banners/uceda-school-las-vegas.png',
  'uceda-school-elizabeth': '/institution-banners/uceda-school-elizabeth.png',
  'uceda-school-boca-raton': '/institution-banners/uceda-school-boca-raton.png',
  'csi-esl': '/institution-banners/csi-esl.png',
};

const toSlugKey = (value: string | null | undefined) =>
  (value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const getInstitutionLocalBannerUrl = (institution: InstitutionLogoSource | null | undefined) => {
  const slugKey = toSlugKey(institution?.slug) || toSlugKey(institution?.name);
  return LOCAL_INSTITUTION_BANNERS[slugKey] ?? null;
};

export const getInstitutionLogoUrl = (institution: InstitutionLogoSource | null | undefined) =>
  institution?.logo_url || getInstitutionLocalBannerUrl(institution);

export const getInstitutionBannerUrl = (institution: InstitutionLogoSource | null | undefined) =>
  getInstitutionLocalBannerUrl(institution) || institution?.logo_url;

export const isLocalInstitutionBannerUrl = (url: string | null | undefined) =>
  Boolean(url && Object.values(LOCAL_INSTITUTION_BANNERS).includes(url));
