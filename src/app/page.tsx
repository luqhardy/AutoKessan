"use client";
import React, { useState, useCallback } from 'react';

// Main App Component
const App = () => {
    // State Management
    const [page, setPage] = useState('upload'); // 'upload', 'verify', 'generate'
    const [receiptImage, setReceiptImage] = useState(null);
    const [receiptImageUrl, setReceiptImageUrl] = useState('');
    const [extractedData, setExtractedData] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [editableData, setEditableData] = useState([]);

    // --- Helper Functions ---
    const toBase64 = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = error => reject(error);
    });

    // --- Event Handlers ---
    const handleImageUpload = (event) => {
        const file = event.target.files[0];
        if (file) {
            setReceiptImage(file);
            setReceiptImageUrl(URL.createObjectURL(file));
            setError('');
        }
    };

    const handleDataExtraction = async () => {
        if (!receiptImage) {
            setError('Please upload a receipt image first.');
            return;
        }
        setIsLoading(true);
        setError('');

        try {
            const base64ImageData = await toBase64(receiptImage);
            const prompt = `
                From the provided image of a Japanese bank transfer confirmation (振込利用明細), 
                extract the list of payees (受取人名) and their corresponding payment amounts (支払金額).
                The output should be a JSON array of objects. Each object should have two keys: "name" (the payee's full name in Japanese) 
                and "amount" (the numerical value of the payment).
                
                Example format:
                [
                    {"name": "上河内さや", "amount": 9900},
                    {"name": "坂口 暁子", "amount": 183764}
                ]
            `;

            const payload = {
                contents: [{
                    role: "user",
                    parts: [
                        { text: prompt },
                        { inlineData: { mimeType: "image/png", data: base64ImageData } }
                    ]
                }],
                generationConfig: {
                    responseMimeType: "application/json",
                }
            };
            
            const apiKey = ""; // API key will be provided by the environment
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`API call failed with status: ${response.status}`);
            }

            const result = await response.json();
            
            if (result.candidates && result.candidates.length > 0 &&
                result.candidates[0].content && result.candidates[0].content.parts &&
                result.candidates[0].content.parts.length > 0) {
                
                const text = result.candidates[0].content.parts[0].text;
                const parsedJson = JSON.parse(text);

                setExtractedData(parsedJson);
                setEditableData(parsedJson.map(item => ({...item, address: '〒523-0892 滋賀県近江八幡市出町'}))); // Create a deep copy for editing and add placeholder address
                setPage('verify');
            } else {
                 throw new Error("Failed to extract data. The AI model returned an unexpected response.");
            }

        } catch (err) {
            console.error("Extraction Error:", err);
            setError(`An error occurred during data extraction: ${err.message}. Please try again.`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDataChange = (index, field, value) => {
        const updatedData = [...editableData];
        updatedData[index][field] = field === 'amount' ? Number(value) : value;
        setEditableData(updatedData);
    };

    const handleVerificationComplete = () => {
        setExtractedData(editableData);
        setPage('generate');
    };
    
    const startOver = () => {
        setPage('upload');
        setReceiptImage(null);
        setReceiptImageUrl('');
        setExtractedData([]);
        setEditableData([]);
        setError('');
    };

    // --- Render Functions ---
    const renderUploadPage = () => (
        <div className="w-full max-w-2xl mx-auto bg-white p-8 rounded-2xl shadow-lg border border-gray-200">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">請求書自動生成アプリ</h1>
            <p className="text-gray-600 mb-6">振込明細の画像をアップロードして、請求書を自動で作成します。</p>
            
            <div className="mb-6">
                <label htmlFor="file-upload" className="block text-sm font-medium text-gray-700 mb-2">ステップ1：振込明細をアップロード</label>
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                    <div className="space-y-1 text-center">
                        <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                            <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <div className="flex text-sm text-gray-600">
                            <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500">
                                <span>ファイルをアップロード</span>
                                <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleImageUpload} accept="image/*" />
                            </label>
                            <p className="pl-1">またはドラッグ＆ドロップ</p>
                        </div>
                        <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
                    </div>
                </div>
            </div>

            {receiptImageUrl && (
                <div className="mb-6 text-center">
                    <p className="text-sm font-medium text-gray-700 mb-2">プレビュー：</p>
                    <img src={receiptImageUrl} alt="Receipt preview" className="max-w-full max-h-64 mx-auto rounded-lg border border-gray-300" />
                </div>
            )}
            
            {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative mb-4" role="alert">{error}</div>}

            <button
                onClick={handleDataExtraction}
                disabled={!receiptImage || isLoading}
                className="w-full bg-indigo-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center transition-all duration-200"
            >
                {isLoading ? (
                    <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        データを抽出中...
                    </>
                ) : (
                    'ステップ2：データ抽出'
                )}
            </button>
        </div>
    );

    const renderVerificationPage = () => (
        <div className="w-full max-w-4xl mx-auto bg-white p-8 rounded-2xl shadow-lg border border-gray-200">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">ステップ3：データの確認と修正</h1>
            <p className="text-gray-600 mb-6">AIが抽出したデータです。間違いがないか確認し、必要であれば修正してください。</p>
            
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">氏名 (Name)</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">住所 (Address)</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">金額 (Amount)</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {editableData.map((item, index) => (
                            <tr key={index}>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <input type="text" value={item.name} onChange={(e) => handleDataChange(index, 'name', e.target.value)} className="w-full p-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500" />
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <input type="text" value={item.address} onChange={(e) => handleDataChange(index, 'address', e.target.value)} className="w-full p-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500" />
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <input type="number" value={item.amount} onChange={(e) => handleDataChange(index, 'amount', e.target.value)} className="w-full p-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500" />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="mt-8 flex justify-between">
                 <button onClick={startOver} className="bg-gray-200 text-gray-700 font-bold py-3 px-6 rounded-lg hover:bg-gray-300 transition-all duration-200">
                    やり直す
                </button>
                <button onClick={handleVerificationComplete} className="bg-indigo-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200">
                    ステップ4：請求書を生成
                </button>
            </div>
        </div>
    );

    const renderGeneratePage = () => (
        <div className="w-full max-w-7xl mx-auto">
             <div className="text-center mb-8 no-print">
                <h1 className="text-3xl font-bold text-gray-800 mb-2">ステップ5：請求書の確認と保存</h1>
                <p className="text-gray-600 mb-6">生成された請求書です。「印刷」ボタンでPDFとして保存できます。</p>
                 <button onClick={startOver} className="bg-indigo-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200">
                    最初からやり直す
                </button>
            </div>
            <div id="invoices-container" className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {extractedData.map((item, index) => (
                    <Invoice key={index} data={item} />
                ))}
            </div>
        </div>
    );

    // --- Page Router ---
    const renderPage = () => {
        switch (page) {
            case 'verify':
                return renderVerificationPage();
            case 'generate':
                return renderGeneratePage();
            case 'upload':
            default:
                return renderUploadPage();
        }
    };

    return (
        <div className="bg-gray-50 min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8 font-sans">
            {renderPage()}
        </div>
    );
};

// Dynamic SVG Hanko (Seal) Component
const HankoSeal = ({ name }) => {
    const lastName = name.split(' ')[0] || '';
    return (
        <div className="relative w-20 h-20">
            <svg viewBox="0 0 100 100" className="w-full h-full">
                <circle cx="50" cy="50" r="48" fill="none" stroke="#E53E3E" strokeWidth="3" />
                <text
                    x="50%"
                    y="50%"
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="#E53E3E"
                    fontSize="32"
                    fontWeight="bold"
                    fontFamily="'MS Mincho', 'Hiragino Mincho ProN', serif"
                    style={{ writingMode: 'vertical-rl', textOrientation: 'upright' }}
                >
                    {lastName}
                </text>
            </svg>
        </div>
    );
};


// Updated Invoice Component to match the user's image
const Invoice = ({ data }) => {
    const recipientName = "株式会社フォナス 御中";
    const recipientAddress1 = "〒529-1551";
    const recipientAddress2 = "滋賀県東近江市宮川町883-103";
    
    const bankInfo = "滋賀銀行 守山支店 普通口座 0405190";
    const bankPayeeName = data.name; // The employee's name for the transfer
    
    const today = new Date();
    const formattedDate = `30/06/24`; // Hardcoded based on image, can be dynamic: `${today.getFullYear()-1988}/${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}`;
    
    const paymentDueDate = `30/07/24`; // Hardcoded based on image, can be dynamic
    
    const printInvoice = () => {
        window.print();
    };

    return (
        <div className="invoice-wrapper bg-white p-4 sm:p-6 border border-gray-400 font-['MS_Mincho',_serif] break-inside-avoid" style={{width: '210mm', height: '148mm', margin: 'auto'}}>
            <style>
                {`
                @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;700&display=swap');
                .font-jp-serif {
                    font-family: 'Noto Serif JP', serif;
                }
                @media print {
                    @page {
                        size: A5 landscape;
                        margin: 0;
                    }
                    body, html {
                        background: #fff;
                    }
                    .invoice-wrapper {
                        border: none;
                        box-shadow: none;
                        border-radius: 0;
                        width: 100%;
                        height: 100%;
                    }
                    .no-print { display: none; }
                    body * { visibility: hidden; }
                    .invoice-wrapper, .invoice-wrapper * { visibility: visible; }
                }
                `}
            </style>
            
            {/* Header */}
            <div className="text-center mb-4 border-b-2 border-gray-400 pb-2">
                <h1 className="text-4xl font-bold font-jp-serif">請 求 書</h1>
            </div>

            {/* Top section */}
            <div className="grid grid-cols-12 gap-4 mb-2">
                <div className="col-span-7">
                    <p className="text-right">発行日</p>
                </div>
                <div className="col-span-5 text-left border-b border-gray-400">
                    {formattedDate}
                </div>
            </div>

            <div className="grid grid-cols-12 gap-4">
                {/* Left side: Recipient */}
                <div className="col-span-7 border-r border-gray-400 pr-4">
                    <p className="text-lg font-bold underline decoration-2 underline-offset-4">{recipientName}</p>
                    <p className="mt-2">{recipientAddress1}</p>
                    <p>{recipientAddress2}</p>
                    <p className="mt-4 border-t border-gray-400 pt-2">下記の通り、ご請求申し上げます。</p>
                </div>

                {/* Right side: Sender */}
                <div className="col-span-5 pl-4">
                     <div className="flex justify-between">
                        <div>
                            <p>{data.address || '〒523-0892'}</p>
                            <p>{data.address ? data.address.split(' ')[1] : '滋賀県近江八幡市出町'}</p>
                            <p className="mt-2 text-lg font-bold">{data.name}</p>
                        </div>
                        <div className="flex-shrink-0">
                            <HankoSeal name={data.name} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Amount section */}
            <div className="grid grid-cols-12 gap-4 mt-2">
                <div className="col-span-7 border-2 border-gray-500 p-2">
                    <p>ご請求金額(税込)</p>
                    <p className="text-center text-3xl font-bold py-2">¥{data.amount.toLocaleString()}</p>
                </div>
                <div className="col-span-5"></div>
            </div>

            {/* Bank details section */}
            <div className="grid grid-cols-12 gap-4 mt-1">
                <div className="col-span-7 border-2 border-gray-500 p-2">
                    <div className="grid grid-cols-4">
                        <div className="col-span-1 border-r border-gray-400 pr-2">振込先</div>
                        <div className="col-span-3 pl-2">{bankInfo}<br/>{bankPayeeName}</div>
                    </div>
                    <div className="grid grid-cols-4 border-t border-gray-400 mt-1 pt-1">
                        <div className="col-span-1 border-r border-gray-400 pr-2">振込期日</div>
                        <div className="col-span-3 pl-2">{paymentDueDate}</div>
                    </div>
                </div>
                 <div className="col-span-5"></div>
            </div>
            <p className="mt-1 text-sm">振込手数料は御社のご負担にてお願いいたします。</p>

            {/* Line items table */}
            <div className="mt-2 border-2 border-gray-500">
                <table className="w-full text-center">
                    <thead>
                        <tr className="border-b-2 border-gray-500">
                            <th className="w-1/4 border-r border-gray-400 p-1"></th>
                            <th className="w-1/2 border-r border-gray-400 p-1">内容</th>
                            <th className="w-1/4 p-1"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {Array.from({ length: 7 }).map((_, i) => (
                            <tr key={i} className="border-b border-gray-400 h-8">
                                <td className="border-r border-gray-400">{i === 0 ? `${new Date().getMonth()+1}月分` : ''}</td>
                                <td className="border-r border-gray-400 text-left pl-2">{i === 0 ? '配膳業務請負料' : ''}</td>
                                <td className="text-right pr-2">{i === 0 ? data.amount.toLocaleString() : ''}</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr className="h-8">
                            <td colSpan="3" className="text-left pl-2 pt-1">備考</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
             <div className="text-center mt-4 no-print">
                <button onClick={printInvoice} className="bg-green-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-600 transition-all duration-200">
                    印刷 / PDF保存
                </button>
            </div>
        </div>
    );
};

export default App;