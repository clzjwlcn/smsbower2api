import { getAnnouncementSettings } from "@/lib/settings";
import { ok } from "@/lib/server";

export async function GET() {
  const announcement = await getAnnouncementSettings();

  return ok({
    announcement:
      announcement.enabled && announcement.body
        ? announcement
        : { enabled: false, title: "", body: "" },
  });
}
