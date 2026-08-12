export type ConfirmedMenuItem = {
  id: string;
  restaurant_id: string;
  name: string;
  description: string | null;
  price: number | null;
  image_url: string | null;
  category: string | null;
  restaurant_name: string;
  lat: number;
  lng: number;
  hero_image_url: string | null;
  address: string;
};

export type SortMode = "distance" | "price_low" | "price_high";
