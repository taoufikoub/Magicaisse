import React, { useEffect, useState } from "react";
import { useAuth } from "./AuthContext.tsx";
import {
  Plus,
  Edit2,
  Trash2,
  Bookmark,
  Store,
  CheckCircle,
  HelpCircle,
  Link,
  ChevronRight,
  PackageCheck,
  Tag,
  Camera,
  UploadCloud,
  Sparkles,
  Loader2,
  Check,
  X,
  FileText,
  DollarSign
} from "lucide-react";

interface Supplier {
  id: number;
  name: string;
}

interface ShopifyConnection {
  id: number;
  brand: string;
  shopifyProductId: string | null;
  shopifyVariantId: string | null;
  shopifyInventoryItemId: string | null;
  shopifyLocationId: string | null;
}

interface Variant {
  id: number;
  sku: string;
  barcode: string | null;
  costPrice: string;
  sellingPrice: string;
  stock: number;
  reservedStock: number;
  shopifyConnections: ShopifyConnection[];
}

interface Product {
  id: number;
  title: string;
  description: string | null;
  category: string;
  ageRange: string;
  status: string;
  supplierId: number | null;
  variants: Variant[];
}

export default function ProductCatalog() {
  const { fetchWithAuth } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  
  // Create Product Form States
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Jeux de société");
  const [ageRange, setAgeRange] = useState("3-6 ans");
  const [description, setDescription] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [sku, setSku] = useState("");
  const [barcode, setBarcode] = useState("");
  const [costPrice, setCostPrice] = useState("10.00");
  const [sellingPrice, setSellingPrice] = useState("19.99");
  const [compareAtPrice, setCompareAtPrice] = useState("");
  const [initialStock, setInitialStock] = useState("15");

  // AI Scanning States
  const [isScanning, setIsScanning] = useState(false);
  const [scannedImage, setScannedImage] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanSuccess, setScanSuccess] = useState(false);

  // Shopify Connection States
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null);
  const [connBrand, setConnBrand] = useState<string>("magijouets");
  const [connProdId, setConnProdId] = useState("");
  const [connVarId, setConnVarId] = useState("");
  const [connInvId, setConnInvId] = useState("");
  const [connLocId, setConnLocId] = useState("");

  // Search and Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("all");

  useEffect(() => {
    fetchProducts();
    fetchSuppliers();
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await fetchWithAuth("/api/products/products");
      if (res.ok) {
        setProducts(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const res = await fetchWithAuth("/api/products/suppliers");
      if (res.ok) {
        setSuppliers(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleImageScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanError(null);
    setScanSuccess(false);
    setIsScanning(true);

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      setScannedImage(base64String);

      try {
        const res = await fetchWithAuth("/api/products/scan", {
          method: "POST",
          body: JSON.stringify({ image: base64String }),
        });

        if (res.ok) {
          const data = await res.json();
          setTitle(data.title || "");
          setDescription(data.description || "");
          setCategory(data.category || "Jeux de société");
          setAgeRange(data.ageRange || "3-6 ans");
          setSku(data.sku || "");
          setBarcode(data.barcode || "");
          setCostPrice(data.costPrice || "10.00");
          setSellingPrice(data.sellingPrice || "19.99");
          setCompareAtPrice(data.compareAtPrice || "");
          setScanSuccess(true);
        } else {
          const errData = await res.json();
          setScanError(errData.error || "Impossible d'analyser l'image. Veuillez réessayer.");
        }
      } catch (err: any) {
        setScanError("Erreur réseau lors de l'analyse de l'image.");
        console.error(err);
      } finally {
        setIsScanning(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !sku || !costPrice || !sellingPrice) {
      alert("Veuillez remplir les champs obligatoires (Titre, SKU, Prix d'achat, Prix de vente).");
      return;
    }

    const payload = {
      title,
      description,
      category,
      ageRange,
      supplierId: supplierId || null,
      variants: [
        {
          sku,
          barcode: barcode || null,
          costPrice,
          sellingPrice,
          compareAtPrice: compareAtPrice || null,
          stock: parseInt(initialStock) || 0,
        },
      ],
    };

    try {
      const res = await fetchWithAuth("/api/products/products", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setShowAddProduct(false);
        // Reset states
        setTitle("");
        setDescription("");
        setCategory("Jeux de société");
        setAgeRange("3-6 ans");
        setSku("");
        setBarcode("");
        setCostPrice("10.00");
        setSellingPrice("19.99");
        setCompareAtPrice("");
        setInitialStock("15");
        setScannedImage(null);
        setScanSuccess(false);
        fetchProducts();
      } else {
        alert("Échec de la création du produit.");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVariant) return;

    const payload = {
      variantId: selectedVariant.id,
      brand: connBrand,
      shopifyProductId: connProdId,
      shopifyVariantId: connVarId,
      shopifyInventoryItemId: connInvId,
      shopifyLocationId: connLocId,
    };

    try {
      const res = await fetchWithAuth("/api/products/shopify/connections", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setSelectedVariant(null);
        setConnProdId("");
        setConnVarId("");
        setConnInvId("");
        setConnLocId("");
        fetchProducts(); // refresh list
      } else {
        alert("Impossible de lier la boutique.");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteConnection = async (connId: number) => {
    if (!confirm("Voulez-vous vraiment supprimer la connexion avec cette boutique Shopify ?")) return;
    try {
      const res = await fetchWithAuth(`/api/products/shopify/connections/${connId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setSelectedVariant(null);
        fetchProducts();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Filter products based on search and selected category filter
  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.variants.some((v) => v.sku.toLowerCase().includes(searchQuery.toLowerCase()) || (v.barcode && v.barcode.includes(searchQuery)));
    const matchesCategory = selectedCategoryFilter === "all" || p.category === selectedCategoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6 h-full flex flex-col text-slate-800">
      {/* Title & Actions */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-200 pb-5 space-y-4 md:space-y-0">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl shadow-sm border border-indigo-100">
            <Bookmark className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-black text-xl text-slate-800 leading-tight">Bibliothèque des Jouets</h2>
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mt-0.5">
              Gestion du catalogue maître & Liaisons Shopify Omnicanal
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => {
              setScannedImage(null);
              setScanSuccess(false);
              setScanError(null);
              setShowAddProduct(true);
            }}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl flex items-center space-x-2 transition-all shadow-lg shadow-indigo-100 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Ajouter un Jouet</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-4 shadow-sm">
        <div className="flex-1 relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher par nom de jouet, SKU, code-barres..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-4 pr-10 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="w-full sm:w-64">
          <select
            value={selectedCategoryFilter}
            onChange={(e) => setSelectedCategoryFilter(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700"
          >
            <option value="all">Toutes les catégories</option>
            <option value="Jeux de société">Jeux de société</option>
            <option value="Figurines">Figurines</option>
            <option value="Poupées & Accessoires">Poupées & Accessoires</option>
            <option value="Véhicules & Circuits">Véhicules & Circuits</option>
            <option value="Jeux d'éveil & Peluches">Jeux d'éveil & Peluches</option>
            <option value="Puzzles">Puzzles</option>
            <option value="Loisirs créatifs">Loisirs créatifs</option>
            <option value="Jeux de construction">Jeux de construction</option>
            <option value="Plein air & Sport">Plein air & Sport</option>
            <option value="Éducatif & Scientifique">Éducatif & Scientifique</option>
          </select>
        </div>
      </div>

      {/* Main product catalog display */}
      <div className="flex-1 overflow-y-auto pr-1">
        {filteredProducts.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm">
            <PackageCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500 font-bold">Aucun jouet ne correspond à vos critères.</p>
            <p className="text-xs text-slate-400 mt-1">Créez-en un nouveau ou modifiez vos filtres de recherche.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {filteredProducts.map((p) => (
              <div
                key={p.id}
                className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:border-indigo-200 hover:shadow-md transition-all"
              >
                <div className="flex flex-col md:flex-row md:justify-between md:items-start space-y-3 md:space-y-0 mb-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="bg-amber-50 border border-amber-100 text-amber-700 text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
                        {p.category}
                      </span>
                      <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
                        Âge : {p.ageRange}
                      </span>
                    </div>
                    <h3 className="font-extrabold text-base text-slate-800 leading-snug">{p.title}</h3>
                    <p className="text-xs text-slate-400 font-medium mt-1">{p.description || "Aucune description fournie."}</p>
                  </div>

                  <div>
                    <span className="text-[9px] font-extrabold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100 uppercase tracking-wider">
                      {p.status === "active" ? "Actif" : p.status}
                    </span>
                  </div>
                </div>

                {/* Variants Section */}
                <div className="border-t border-slate-100 pt-4 space-y-4">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center space-x-1.5">
                    <Tag className="w-3.5 h-3.5 text-slate-400" />
                    <span>Variantes de jouets & Canaux Shopify</span>
                  </h4>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {p.variants?.map((v) => (
                      <div
                        key={v.id}
                        className="bg-slate-50/50 border border-slate-200 rounded-xl p-4 flex flex-col justify-between"
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <span className="font-mono text-xs font-black text-slate-700 block">
                              SKU : {v.sku}
                            </span>
                            <span className="text-[10px] text-slate-400 block font-mono">
                              EAN-13 : {v.barcode || "N/A"}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-black text-indigo-600 block">
                              {v.sellingPrice} DH
                            </span>
                            <span className="text-[10px] text-slate-400 font-semibold block">
                              Achat : {v.costPrice} DH
                            </span>
                          </div>
                        </div>

                        {/* Sync indicators / connection labels */}
                        <div className="bg-white border border-slate-200 rounded-lg p-3 mb-3.5 space-y-2">
                          <span className="text-[9px] font-extrabold text-slate-400 block uppercase tracking-wider">
                            Boutiques Shopify Connectées :
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {v.shopifyConnections?.map((conn) => (
                              <div
                                key={conn.id}
                                className="flex items-center space-x-1 bg-slate-50 border border-slate-200 px-2 py-1 rounded-lg text-xs font-semibold text-slate-600"
                              >
                                <Store className="w-3 h-3 text-indigo-500" />
                                <span className="capitalize text-[10px]">{conn.brand.replace("_", " ")}</span>
                                <button
                                  onClick={() => handleDeleteConnection(conn.id)}
                                  className="text-rose-500 hover:text-rose-700 font-extrabold ml-1.5 text-xs focus:outline-none cursor-pointer"
                                  title="Déconnecter"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                            {(!v.shopifyConnections || v.shopifyConnections.length === 0) && (
                              <span className="text-[10px] text-slate-400 font-medium">
                                Non synchronisé avec les boutiques en ligne.
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Stock balances and Connect button */}
                        <div className="flex items-center justify-between mt-auto pt-2 border-t border-slate-200/50">
                          <div className="flex space-x-4 text-xs font-bold text-slate-500">
                            <div>
                              Stock : <span className="text-slate-800 font-extrabold">{v.stock}</span>
                            </div>
                            <div>
                              Réservé : <span className="text-amber-600 font-extrabold">{v.reservedStock}</span>
                            </div>
                          </div>

                          <button
                            onClick={() => setSelectedVariant(v)}
                            className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-lg flex items-center space-x-1 transition-all cursor-pointer"
                          >
                            <Link className="w-3 h-3" />
                            <span>Lier à Shopify</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL 1: ADD NEW PRODUCT FORM WITH AI SCANNING */}
      {showAddProduct && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl shadow-2xl border border-slate-200 my-8">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-4">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-indigo-600" />
                <h3 className="font-black text-lg text-slate-800">Ajouter un nouveau jouet</h3>
              </div>
              <button
                onClick={() => setShowAddProduct(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* AI Scanning Banner / Area */}
            <div className="mb-6 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-2xl">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
                <div className="flex items-start space-x-3">
                  <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-md">
                    <Camera className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-slate-800 flex items-center space-x-1">
                      <span>Remplissage automatique par I.A.</span>
                      <span className="text-[9px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full uppercase tracking-wider font-bold">Gemini</span>
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Prenez en photo la boîte d'un jouet pour en extraire instantanément toutes les infos !
                    </p>
                  </div>
                </div>

                <div className="relative">
                  <input
                    type="file"
                    accept="image/*"
                    id="ai-scan-upload"
                    onChange={handleImageScan}
                    className="hidden"
                    disabled={isScanning}
                  />
                  <label
                    htmlFor="ai-scan-upload"
                    className={`px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 cursor-pointer shadow-md shadow-indigo-100 transition-all ${
                      isScanning ? "opacity-50 pointer-events-none" : ""
                    }`}
                  >
                    {isScanning ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Analyse en cours...</span>
                      </>
                    ) : (
                      <>
                        <UploadCloud className="w-3.5 h-3.5" />
                        <span>Scanner l'image</span>
                      </>
                    )}
                  </label>
                </div>
              </div>

              {/* Status scan feedbacks */}
              {isScanning && (
                <div className="mt-3 flex items-center space-x-2 text-xs text-indigo-600 font-bold animate-pulse">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Gemini analyse les textes de l'image, calcule un SKU intelligent et estime les tarifs...</span>
                </div>
              )}

              {scanSuccess && (
                <div className="mt-3 p-2 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-lg text-xs flex items-center space-x-2 font-semibold">
                  <Check className="w-4 h-4 text-emerald-500" />
                  <span>Informations extraites avec succès ! Veuillez vérifier et valider les détails ci-dessous.</span>
                </div>
              )}

              {scanError && (
                <div className="mt-3 p-2 bg-rose-50 border border-rose-100 text-rose-800 rounded-lg text-xs flex items-center space-x-2 font-semibold">
                  <X className="w-4 h-4 text-rose-500" />
                  <span>{scanError}</span>
                </div>
              )}

              {scannedImage && (
                <div className="mt-3 flex items-center space-x-3">
                  <img src={scannedImage} alt="Jouet à scanner" className="w-16 h-16 object-cover rounded-xl border border-indigo-200" />
                  <span className="text-[10px] text-slate-400 font-medium">Aperçu du jouet importé</span>
                </div>
              )}
            </div>

            <form onSubmit={handleCreateProduct} className="space-y-4 max-h-[50vh] overflow-y-auto pr-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-500 mb-1">Nom / Titre du jouet *</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold text-slate-700"
                    placeholder="Ex: Mon Poney Magique Rose"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Catégorie *</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold text-slate-700"
                  >
                    <option value="Jeux de société">Jeux de société</option>
                    <option value="Figurines">Figurines</option>
                    <option value="Poupées & Accessoires">Poupées & Accessoires</option>
                    <option value="Véhicules & Circuits">Véhicules & Circuits</option>
                    <option value="Jeux d'éveil & Peluches">Jeux d'éveil & Peluches</option>
                    <option value="Puzzles">Puzzles</option>
                    <option value="Loisirs créatifs">Loisirs créatifs</option>
                    <option value="Jeux de construction">Jeux de construction</option>
                    <option value="Plein air & Sport">Plein air & Sport</option>
                    <option value="Éducatif & Scientifique">Éducatif & Scientifique</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Tranche d'âge *</label>
                  <select
                    value={ageRange}
                    onChange={(e) => setAgeRange(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold text-slate-700"
                  >
                    <option value="0-3 ans">0-3 ans</option>
                    <option value="3-6 ans">3-6 ans</option>
                    <option value="6-9 ans">6-9 ans</option>
                    <option value="9-12 ans">9-12 ans</option>
                    <option value="12+ ans">12+ ans</option>
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-500 mb-1">Fournisseur</label>
                  <select
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold text-slate-700"
                  >
                    <option value="">Sélectionner un fournisseur (Optionnel)</option>
                    {suppliers.map((sup) => (
                      <option key={sup.id} value={sup.id}>
                        {sup.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-500 mb-1">Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold text-slate-700"
                    placeholder="Brève description en français..."
                  />
                </div>
              </div>

              {/* Initial Variant Details */}
              <div className="border-t border-slate-100 pt-4 space-y-4">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                  Configuration de la première variante
                </span>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">SKU Unique *</label>
                    <input
                      type="text"
                      required
                      value={sku}
                      onChange={(e) => setSku(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono font-bold text-slate-700"
                      placeholder="Ex: JOUET-BARBIE-001"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Code-barres EAN-13</label>
                    <input
                      type="text"
                      value={barcode}
                      onChange={(e) => setBarcode(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono font-bold text-slate-700"
                      placeholder="Ex: 3700000000000"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Prix d'achat / de revient (DH) *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={costPrice}
                      onChange={(e) => setCostPrice(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Prix de vente conseillé (DH) *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={sellingPrice}
                      onChange={(e) => setSellingPrice(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-indigo-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Prix barré / d'origine (DH)</label>
                    <input
                      type="text"
                      value={compareAtPrice}
                      onChange={(e) => setCompareAtPrice(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700"
                      placeholder="Ex: 24.99 (ou laisser vide)"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1 font-extrabold text-indigo-600">
                      Stock physique initial en boutique
                    </label>
                    <input
                      type="number"
                      required
                      value={initialStock}
                      onChange={(e) => setInitialStock(e.target.value)}
                      className="w-full bg-indigo-50 border border-indigo-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-black text-indigo-800"
                    />
                  </div>
                </div>
              </div>

              <div className="flex space-x-3 pt-4 border-t border-slate-100 mt-6">
                <button
                  type="button"
                  onClick={() => setShowAddProduct(false)}
                  className="w-1/2 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all shadow-lg shadow-indigo-100 cursor-pointer"
                >
                  Enregistrer dans la bibliothèque
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: LINK SHOPIFY CHANNEL CHANNELS FORM */}
      {selectedVariant && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-slate-200">
            <h3 className="font-extrabold text-lg text-slate-800 mb-1 flex items-center space-x-1.5">
              <Store className="w-5 h-5 text-indigo-500" />
              <span>Lier à un produit Shopify</span>
            </h3>
            <p className="text-xs text-slate-400 font-semibold mb-4 uppercase tracking-wider">
              Correspondance SKU pour : {selectedVariant.sku}
            </p>

            <form onSubmit={handleCreateConnection} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Boutique Shopify Cible</label>
                <select
                  value={connBrand}
                  onChange={(e) => setConnBrand(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700"
                >
                  <option value="magijouets">Magijouets</option>
                  <option value="libijouets">Libijouets</option>
                  <option value="allez_jouets">Allez Jouets</option>
                  <option value="kids_heaven">Kids Heaven</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">ID du Produit Shopify</label>
                <input
                  type="text"
                  required
                  value={connProdId}
                  onChange={(e) => setConnProdId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-mono text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Ex: gid://shopify/Product/12345678"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">ID de la Variante Shopify</label>
                <input
                  type="text"
                  required
                  value={connVarId}
                  onChange={(e) => setConnVarId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-mono text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Ex: gid://shopify/ProductVariant/87654321"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">ID de l'article d'inventaire (Inventory Item ID)</label>
                <input
                  type="text"
                  required
                  value={connInvId}
                  onChange={(e) => setConnInvId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-mono text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Ex: gid://shopify/InventoryItem/565656"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">ID de l'emplacement Shopify (Location ID)</label>
                <input
                  type="text"
                  required
                  value={connLocId}
                  onChange={(e) => setConnLocId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-mono text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Ex: gid://shopify/Location/99999"
                />
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedVariant(null)}
                  className="w-1/2 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all shadow-lg shadow-indigo-100 cursor-pointer"
                >
                  Créer la liaison
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
