"use client";

import { useState, useEffect } from "react";
import {
  Plus,
  Edit,
  Trash2,
  Search,
  Package,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Filter,
  FileText,
} from "lucide-react";
import Modal from "@/components/dashboard/Modal";
import FormInput, {
  FormSelect,
  FormButton,
} from "@/components/dashboard/FormInput";
import PermissionGate from "@/components/PermissionGate";
import { useSettings } from "@/components/providers/SettingsProvider";
import ImageUpload from "@/components/dashboard/ImageUpload";

interface Product {
  _id: string;
  name: string;
  category: string;
  brand: string;
  price: number;
  costPrice: number;
  stock: number;
  type: string;
  image?: string;
  status: string;
  commissionType?: "fixed" | "percentage";
  commissionValue?: number;
}

export default function ProductsPage() {
  const { settings } = useSettings();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<any>({
    total: 0,
    page: 1,
    limit: 10,
    pages: 0,
  });
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        activeDropdown &&
        !(event.target as Element).closest(".dropdown-trigger")
      ) {
        setActiveDropdown(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [activeDropdown]);

  const [formData, setFormData] = useState({
    name: "",
    category: "",
    brand: "",
    price: 0,
    costPrice: 0,
    stock: 0,
    type: "retail",
    alertQuantity: 5,
    image: "",
    status: "active",
    commissionType: "fixed" as "fixed" | "percentage",
    commissionValue: 0,
  });

  useEffect(() => {
    fetchProducts();
  }, [page]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchProducts();
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      query.append("page", page.toString());
      query.append("limit", "10");
      if (search) query.append("search", search);

      const res = await fetch(`/api/products?${query.toString()}`);
      const data = await res.json();
      if (data.success) {
        setProducts(data.data);
        if (data.pagination) setPagination(data.pagination);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const url = editingProduct
        ? `/api/products/${editingProduct._id}`
        : "/api/products";
      const res = await fetch(url, {
        method: editingProduct ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (data.success) {
        fetchProducts();
        closeModal();
      } else {
        alert(data.error || "Something went wrong");
      }
    } catch (error) {
      console.error(error);
      alert("An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this product?")) return;
    const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
    if ((await res.json()).success) fetchProducts();
  };

  const openModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name,
        category: product.category,
        brand: product.brand,
        price: product.price,
        costPrice: product.costPrice,
        stock: product.stock,
        type: product.type,
        image: product.image || "",
        alertQuantity: 5, // Default or fetch
        status: product.status,
        commissionType: product.commissionType || "fixed",
        commissionValue: product.commissionValue ?? 0,
      });
    } else {
      setEditingProduct(null);
      setFormData({
        name: "",
        category: "",
        brand: "",
        price: 0,
        costPrice: 0,
        stock: 0,
        image: "",
        type: "retail",
        alertQuantity: 5,
        status: "active",
        commissionType: "fixed",
        commissionValue: 0,
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header Section */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
              <p className="text-sm text-gray-500">
                Manage your product stock, pricing and retail items
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
              <PermissionGate resource="products" action="create">
                <button
                  onClick={() => openModal()}
                  className="px-4 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800 transition-all flex justify-center items-center gap-2 shadow-sm font-semibold text-sm w-full sm:w-auto"
                >
                  <Plus className="w-4 h-4" />
                  Add Product
                </button>
              </PermissionGate>
            </div>
          </div>

          {/* Main Card */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden text-black">
            {/* Filters Bar */}
            <div className="p-4 border-b border-gray-200 flex flex-col md:flex-row gap-4 items-center justify-between bg-gray-50/50">
              <div className="relative w-full md:w-96">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search by product name..."
                  className="w-full pl-10 pr-4 py-2 bg-white text-gray-900 placeholder:text-gray-400 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 transition-all text-sm"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                <button
                  onClick={() => {
                    setSearch("");
                    setPage(1);
                  }}
                  className="text-gray-500 hover:text-gray-700 font-medium text-sm px-2 w-full sm:w-auto text-center"
                >
                  Reset
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 hidden md:table">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Product
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Stock
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Price
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {loading && products.length === 0 ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td colSpan={6} className="px-6 py-4">
                          <div className="h-4 bg-gray-100 rounded"></div>
                        </td>
                      </tr>
                    ))
                  ) : products.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-6 py-12 text-center text-gray-500"
                      >
                        <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p>No products found</p>
                      </td>
                    </tr>
                  ) : (
                    products.map((product) => (
                      <tr
                        key={product._id}
                        className="hover:bg-gray-50/50 transition-colors"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-orange-50 rounded-lg">
                              <Package className="w-4 h-4 text-orange-600" />
                            </div>
                            <div>
                              <span className="text-sm font-bold text-gray-900">
                                {product.name}
                              </span>
                              <div className="text-[10px] text-gray-400 font-medium uppercase">
                                {product.brand || "No Brand"}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-gray-50 text-gray-700 border border-gray-200">
                            {product.category || "Uncategorized"}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`text-sm font-bold ${product.stock <= 5 ? "text-red-600" : "text-gray-900"}`}
                            >
                              {product.stock}
                            </span>
                            {product.stock <= 5 && (
                              <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-bold text-gray-900">
                            {settings.symbol}
                            {product.price.toLocaleString("id-ID", {
                              maximumFractionDigits: 0,
                            })}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`text-[10px] uppercase tracking-widest font-black px-2.5 py-1 rounded-full border ${product.type === "retail" ? "bg-green-50 text-green-700 border-green-200" : "bg-purple-50 text-purple-700 border-purple-200"}`}
                          >
                            {product.type}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                          <div className="relative flex justify-end dropdown-trigger">
                            <button
                              onClick={() =>
                                setActiveDropdown(
                                  activeDropdown === product._id
                                    ? null
                                    : product._id,
                                )
                              }
                              className="p-2 text-gray-400 hover:text-blue-900 hover:bg-blue-50 rounded-lg transition-all"
                            >
                              <MoreVertical className="w-5 h-5" />
                            </button>

                            {activeDropdown === product._id && (
                              <div className="absolute right-0 mt-10 w-48 bg-white border border-gray-100 rounded-xl shadow-xl z-50 py-1 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 text-left">
                                <PermissionGate
                                  resource="products"
                                  action="edit"
                                >
                                  <button
                                    onClick={() => {
                                      openModal(product);
                                      setActiveDropdown(null);
                                    }}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 transition-colors"
                                  >
                                    <Edit className="w-4 h-4 text-blue-600" />
                                    Edit Details
                                  </button>
                                </PermissionGate>
                                <div className="h-px bg-gray-100 my-1" />
                                <PermissionGate
                                  resource="products"
                                  action="delete"
                                >
                                  <button
                                    onClick={() => {
                                      handleDelete(product._id);
                                      setActiveDropdown(null);
                                    }}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                    Delete Product
                                  </button>
                                </PermissionGate>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              {/* Mobile Card View (Products) */}
              <div className="md:hidden flex flex-col divide-y divide-gray-100 border-t border-gray-100">
                {loading && products.length === 0 ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="p-4 animate-pulse space-y-3">
                      <div className="h-4 bg-gray-100 rounded w-1/2"></div>
                      <div className="h-4 bg-gray-100 rounded w-1/3"></div>
                    </div>
                  ))
                ) : products.length === 0 ? (
                  <div className="p-12 text-center text-gray-500">
                    <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p>No products found</p>
                  </div>
                ) : (
                  products.map((product) => (
                    <div
                      key={product._id}
                      className="p-4 hover:bg-gray-50/50 transition-colors flex flex-col gap-3"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-orange-50 rounded-lg">
                            <Package className="w-4 h-4 text-orange-600" />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-gray-900">
                              {product.name}
                            </h3>
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-gray-50 text-gray-700 border border-gray-200 mt-1">
                              {product.category || "Uncategorized"}
                            </span>
                          </div>
                        </div>
                        <div className="relative dropdown-trigger">
                          <button
                            onClick={() =>
                              setActiveDropdown(
                                activeDropdown === product._id
                                  ? null
                                  : product._id,
                              )
                            }
                            className="p-2 -mr-2 text-gray-400 hover:text-blue-900 rounded-lg"
                          >
                            <MoreVertical className="w-5 h-5" />
                          </button>
                          {activeDropdown === product._id && (
                            <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-100 rounded-xl shadow-xl z-50 py-1 font-medium">
                              <PermissionGate resource="products" action="edit">
                                <button
                                  onClick={() => {
                                    openModal(product);
                                    setActiveDropdown(null);
                                  }}
                                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50"
                                >
                                  <Edit className="w-4 h-4 text-blue-600" />{" "}
                                  Edit Details
                                </button>
                              </PermissionGate>
                              <div className="h-px bg-gray-100 my-1" />
                              <PermissionGate
                                resource="products"
                                action="delete"
                              >
                                <button
                                  onClick={() => {
                                    handleDelete(product._id);
                                    setActiveDropdown(null);
                                  }}
                                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
                                >
                                  <Trash2 className="w-4 h-4" /> Delete Product
                                </button>
                              </PermissionGate>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-sm pt-1 border-t border-gray-50 mt-1">
                        <div>
                          <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">
                            Stock
                          </p>
                          <div className="flex items-center gap-1.5 font-semibold">
                            <span
                              className={
                                product.stock <= 5
                                  ? "text-red-600"
                                  : "text-gray-900"
                              }
                            >
                              {product.stock} units
                            </span>
                            {product.stock <= 5 && (
                              <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                            )}
                          </div>
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">
                            Brand
                          </p>
                          <p className="font-semibold text-gray-900 capitalize">
                            {product.brand || "No Brand"}
                          </p>
                        </div>
                      </div>

                      <div className="flex justify-between items-end pt-2 mt-1">
                        <div>
                          <span
                            className={`text-[10px] uppercase tracking-widest font-black px-2.5 py-1 rounded-full border ${product.type === "retail" ? "bg-green-50 text-green-700 border-green-200" : "bg-purple-50 text-purple-700 border-purple-200"}`}
                          >
                            {product.type}
                          </span>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-0.5">
                            Price
                          </p>
                          <span className="text-lg font-black text-gray-900">
                            {settings.symbol}
                            {product.price.toLocaleString("id-ID", {
                              maximumFractionDigits: 0,
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Pagination */}
            <div className="px-4 py-4 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-sm text-gray-500 font-medium text-center sm:text-left">
                Showing <span className="text-gray-900">{products.length}</span>{" "}
                of <span className="text-gray-900">{pagination.total}</span>{" "}
                products
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => page > 1 && setPage(page - 1)}
                  disabled={page <= 1}
                  className="p-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-1">
                  {Array.from(
                    { length: Math.min(5, pagination.pages) },
                    (_, i) => {
                      let pageNum;
                      if (pagination.pages <= 5) {
                        pageNum = i + 1;
                      } else if (pagination.page <= 3) {
                        pageNum = i + 1;
                      } else if (pagination.page >= pagination.pages - 2) {
                        pageNum = pagination.pages - 4 + i;
                      } else {
                        pageNum = pagination.page - 2 + i;
                      }
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setPage(pageNum)}
                          className={`w-8 h-8 rounded-lg text-sm font-semibold transition-all ${
                            page === pageNum
                              ? "bg-blue-900 text-white"
                              : "text-gray-600 hover:bg-gray-100"
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    },
                  )}
                </div>
                <button
                  onClick={() => page < pagination.pages && setPage(page + 1)}
                  disabled={page >= pagination.pages}
                  className="p-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingProduct ? "Edit Product" : "Add Product"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {" "}
          <div className="mb-4">
            <ImageUpload
              label="Product Image"
              value={formData.image || ""}
              onChange={(url) =>
                setFormData((prev) => ({ ...prev, image: url }))
              }
            />
          </div>{" "}
          <FormInput
            label="Product Name"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormInput
              label="Category"
              required
              value={formData.category}
              onChange={(e) =>
                setFormData({ ...formData, category: e.target.value })
              }
            />
            <FormInput
              label="Brand"
              value={formData.brand}
              onChange={(e) =>
                setFormData({ ...formData, brand: e.target.value })
              }
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormInput
              label={`Retail Price (${settings.symbol})`}
              type="number"
              required
              value={formData.price}
              onChange={(e) =>
                setFormData({ ...formData, price: parseFloat(e.target.value) })
              }
            />
            <FormInput
              label={`Cost Price (${settings.symbol})`}
              type="number"
              required
              value={formData.costPrice}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  costPrice: parseFloat(e.target.value),
                })
              }
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormInput
              label="Stock"
              type="number"
              required
              value={formData.stock}
              onChange={(e) =>
                setFormData({ ...formData, stock: parseInt(e.target.value) })
              }
            />
            <FormSelect
              label="Type"
              value={formData.type}
              onChange={(e: any) =>
                setFormData({ ...formData, type: e.target.value })
              }
              options={[
                { value: "retail", label: "Retail Sale" },
                { value: "internal", label: "Internal Use" },
              ]}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormSelect
              label="Tipe Komisi"
              value={formData.commissionType}
              onChange={(e: any) =>
                setFormData({
                  ...formData,
                  commissionType: e.target.value as "fixed" | "percentage",
                })
              }
              options={[
                { value: "fixed", label: "Nominal Tetap" },
                { value: "percentage", label: "Persentase" },
              ]}
            />
            <FormInput
              label={
                formData.commissionType === "percentage"
                  ? "Komisi (%)"
                  : `Komisi (${settings.symbol})`
              }
              type="number"
              value={formData.commissionValue}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  commissionValue: parseFloat(e.target.value) || 0,
                })
              }
              min="0"
            />
          </div>
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 mt-6 pt-2">
            <button
              type="button"
              onClick={closeModal}
              className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors text-center"
            >
              Cancel
            </button>
            <FormButton
              type="submit"
              loading={submitting}
              className="w-full sm:w-auto"
            >
              {editingProduct ? "Update Product" : "Add Product"}
            </FormButton>
          </div>
        </form>
      </Modal>
    </div>
  );
}
