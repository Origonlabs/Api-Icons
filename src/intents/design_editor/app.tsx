import {
  Button,
  Rows,
  Text,
  FormField,
  TextInput,
  Box,
  Title,
} from "@canva/app-ui-kit";
import { upload } from "@canva/asset";
import { addNativeElement } from "@canva/design";
import { useFeatureSupport } from "@canva/app-hooks";
import React, { useEffect, useMemo, useState } from "react";
import iconManifest from "../../../assets_manifest.json";
import * as styles from "styles/components.css";

type IconEntry = {
  id: string;
  category: string;
  categorySlug: string;
  name: string;
  description?: string;
  keyword?: string;
  tags: string[];
  size?: number;
  style?: string;
  file: string;
  relativePath: string;
  cdnUrl: string | null;
};

const ICONS: IconEntry[] = (iconManifest.icons as IconEntry[]) ?? [];

const getIconUrl = (icon: IconEntry) => {
  if (icon.cdnUrl) {
    return icon.cdnUrl;
  }

  if (icon.relativePath.startsWith("http")) {
    return icon.relativePath;
  }

  const base = window.location.origin;
  return new URL(icon.relativePath, `${base}/`).toString();
};

export const App = () => {
  const supportsFeature = useFeatureSupport();
  const isUploadSupported = supportsFeature(addNativeElement);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [styleFilter, setStyleFilter] = useState("all");
  const [visibleCount, setVisibleCount] = useState(60);
  const [activeIconId, setActiveIconId] = useState<string | null>(null);

  const categories = useMemo(() => {
    const result = new Map<string, number>();
    ICONS.forEach((icon) => {
      result.set(icon.categorySlug, (result.get(icon.categorySlug) ?? 0) + 1);
    });
    return Array.from(result.entries())
      .map(([slug, count]) => {
        const icon = ICONS.find((entry) => entry.categorySlug === slug);
        return {
          slug,
          label: icon?.category ?? slug,
          count,
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }, []);

  const stylesAvailable = useMemo(() => {
    const set = new Set<string>();
    ICONS.forEach((icon) => {
      if (icon.style) {
        set.add(icon.style);
      }
    });
    return Array.from(set).sort();
  }, []);

  useEffect(() => {
    setVisibleCount(60);
  }, [search, category, styleFilter]);

  const filteredIcons = useMemo(() => {
    return ICONS.filter((icon) => {
      const matchesCategory =
        category === "all" || icon.categorySlug === category;
      const matchesStyle =
        styleFilter === "all" ||
        (icon.style ? icon.style === styleFilter : false);
      const needle = search.trim().toLowerCase();
      const matchesSearch =
        needle.length === 0 ||
        icon.name.toLowerCase().includes(needle) ||
        icon.tags.some((tag) => tag.toLowerCase().includes(needle)) ||
        icon.category.toLowerCase().includes(needle);

      return matchesCategory && matchesStyle && matchesSearch;
    });
  }, [search, category, styleFilter]);

  const visibleIcons = filteredIcons.slice(0, visibleCount);

  const onLoadMore = () => {
    setVisibleCount((count) => count + 60);
  };

  const onInsertIcon = async (icon: IconEntry) => {
    if (!isUploadSupported) {
      return;
    }

    try {
      setActiveIconId(icon.id);
      const iconUrl = getIconUrl(icon);
      const { ref } = await upload({
        type: "image",
        mimeType: "image/svg+xml",
        url: iconUrl,
        thumbnailUrl: iconUrl,
        aiDisclosure: "none",
        width: icon.size || 24,
        height: icon.size || 24,
      });

      await addNativeElement({
        type: "image",
        ref,
        altText: { text: icon.name, decorative: false },
      });
    } catch (error) {
      console.error("Failed to insert icon", error);
    } finally {
      setActiveIconId(null);
    }
  };

  return (
    <div className={styles.scrollContainer}>
      <Rows spacing="2u">
        <Title size="small">Icon Library</Title>
        <Text tone="secondary">
          Browse {ICONS.length.toLocaleString()} SVG icons and drop them into
          your design instantly.
        </Text>

        <FormField
          label="Search icons"
          control={(props) => (
            <TextInput
              {...props}
              value={search}
              onChange={setSearch}
              placeholder="Search by name, tag, or category"
            />
          )}
        />

        <div className={styles.filtersRow}>
          <FormField
            label="Category"
            control={(props) => (
              <select
                {...props}
                className={styles.selectField}
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              >
                <option value="all">All categories</option>
                {categories.map((entry) => (
                  <option key={entry.slug} value={entry.slug}>
                    {entry.label} ({entry.count})
                  </option>
                ))}
              </select>
            )}
          />

          <FormField
            label="Style"
            control={(props) => (
              <select
                {...props}
                className={styles.selectField}
                value={styleFilter}
                onChange={(event) => setStyleFilter(event.target.value)}
              >
                <option value="all">Any style</option>
                {stylesAvailable.map((styleName) => (
                  <option key={styleName} value={styleName}>
                    {styleName}
                  </option>
                ))}
              </select>
            )}
          />
        </div>

        <Box display="flex" flexDirection="row" alignItems="center">
          <Text>{filteredIcons.length} icons</Text>
          {category !== "all" && (
            <Text tone="secondary">
              {" · Category: "}
              {categories.find((entry) => entry.slug === category)?.label ??
                category}
            </Text>
          )}
          {styleFilter !== "all" && (
            <Text tone="secondary">
              {" · Style: "}
              {styleFilter}
            </Text>
          )}
        </Box>

        <div className={styles.grid}>
          {visibleIcons.map((icon) => (
            <button
              key={icon.id}
              className={styles.iconCard}
              onClick={() => onInsertIcon(icon)}
              disabled={!isUploadSupported || activeIconId === icon.id}
            >
              <div className={styles.iconPreview}>
                <img src={getIconUrl(icon)} alt={icon.name} />
              </div>
              <div className={styles.iconInfo}>
                <Text variant="bold">{icon.name}</Text>
                <Text size="small" tone="secondary">
                  {icon.size ? `${icon.size}px` : "—"} ·{" "}
                  {icon.style ?? "unknown"}
                </Text>
              </div>
            </button>
          ))}
        </div>

        {visibleIcons.length === 0 && (
          <div className={styles.emptyState}>
            <Text>No icons match your filters.</Text>
            <Button variant="secondary" onClick={() => setSearch("")}>
              Clear search
            </Button>
          </div>
        )}

        {visibleIcons.length < filteredIcons.length && (
          <Button variant="secondary" onClick={onLoadMore} stretch>
            Load more icons
          </Button>
        )}

        {!isUploadSupported && (
          <Text tone="critical">
            Icon insertion is not supported in this environment.
          </Text>
        )}
      </Rows>
    </div>
  );
};
