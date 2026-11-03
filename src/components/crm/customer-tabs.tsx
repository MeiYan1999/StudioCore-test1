"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function CustomerTabs({
  overview,
  orders,
  interactions,
}: {
  overview: React.ReactNode;
  orders: React.ReactNode;
  interactions: React.ReactNode;
}) {
  return (
    <Tabs defaultValue="overview">
      <TabsList>
        <TabsTrigger value="overview">Tổng quan</TabsTrigger>
        <TabsTrigger value="orders">Đơn hàng</TabsTrigger>
        <TabsTrigger value="interactions">Tương tác</TabsTrigger>
      </TabsList>
      <TabsContent value="overview">{overview}</TabsContent>
      <TabsContent value="orders">{orders}</TabsContent>
      <TabsContent value="interactions">{interactions}</TabsContent>
    </Tabs>
  );
}
